import express from 'express';
import { verifyWebhookSignature } from '../middleware/index.js';
import MessageProcessor from '../services/MessageProcessor.js';
import AIEngine from '../services/AIEngine.js';
import IntentRouter from '../services/IntentRouter.js';
import whatsapp from '../services/WhatsAppService.js';
import ContextEngine from '../services/ContextEngine.js';
import ReminderService from '../services/ReminderService.js';
import RoutineService from '../services/RoutineService.js';
import ActivityService from '../services/ActivityService.js';
import OnboardingService from '../services/OnboardingService.js';
import OnDemandScheduler from '../services/OnDemandScheduler.js';
import User from '../models/User.js';
import Reminder from '../models/Reminder.js';
import logger from '../utils/logger.js';
import { connectDB } from '../utils/database.js';
import { parseTimeInKolkata, formatTimeInKolkata } from '../utils/timezone.js';

const router = express.Router();
let aiEngine, whatsappService, onDemandScheduler;

// Initialize services
try {
  aiEngine = new AIEngine();
  whatsappService = new whatsapp();
  onDemandScheduler = new OnDemandScheduler();
} catch (error) {
  console.error('🔴 SERVICE INIT ERROR:', error);
  logger.error('Failed to initialize services:', error.message);
  logger.error('Full error object:', JSON.stringify(error, null, 2));
}

/**
 * Parse time string to DateTime using Asia/Kolkata timezone (NO UTC conversion!)
 * Handles formats like "09:00", "9 AM", "2:30 PM", "tomorrow 3 PM", "10:43 AM today", etc.
 * 
 * @param {string} timeStr - Time input string
 * @returns {string|null} - ISO datetime with +05:30 offset (e.g., "2026-03-28T11:22:00+05:30") or null if invalid
 */
function parseTimeToDateTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    logger.debug('Invalid time string:', timeStr);
    return null;
  }

  try {
    const parsedTime = parseTimeInKolkata(timeStr);
    
    if (!parsedTime) {
      logger.warn('Could not parse time string:', { input: timeStr });
      return null;
    }

    // Log for debugging
    const displayTime = formatTimeInKolkata(parsedTime, 'yyyy-MM-dd HH:mm:ss');
    logger.info('✅ Time parsed in Asia/Kolkata timezone (NO UTC):', {
      input: timeStr,
      storedInDB: parsedTime,
      displayTime: displayTime
    });

    return parsedTime;
  } catch (error) {
    logger.error('Error parsing time:', { error: error.message, input: timeStr });
    return null;
  }
}



/**
 * GET /webhook/ping
 * Simple ping - MUST ALWAYS WORK
 */
router.get('/ping', (req, res) => {
  console.log('🟢🟢🟢 WEBHOOK PING HIT 🟢🟢🟢');
  logger.info('🟢 WEBHOOK PING HIT - Server is responding');
  res.status(200).json({
    status: 'pong',
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET/POST /webhook/trigger-reminders
 * Manual endpoint to trigger reminder checks (for external cron services)
 * Can be called by services like EasyCron to check reminders on a schedule
 * Accepts both GET and POST (some services send GET by default)
 */
const triggerRemindersHandler = async (req, res) => {
  try {
    await connectDB();
    
    logger.info('🔔 Manual reminder check triggered via webhook');
    if (!onDemandScheduler) {
      throw new Error('OnDemandScheduler not initialized - services initialization failed');
    }
    await onDemandScheduler.checkAndSendAllDueReminders();
    
    res.status(200).json({
      success: true,
      message: 'Reminder check triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to trigger reminder check:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

router.get('/trigger-reminders', triggerRemindersHandler);
router.post('/trigger-reminders', triggerRemindersHandler);

/**
 * POST /webhook/whatsapp
 * Receive and process incoming WhatsApp messages
 */
router.post('/whatsapp', verifyWebhookSignature, async (req, res) => {
  try {
    await connectDB();
    if (!aiEngine || !whatsappService) {
      return res.status(503).json({ error: 'Services not initialized' });
    }

    // Parse incoming message
    const rawMessage = whatsappService.parseWebhookMessage(req.body);

    if (!rawMessage) {
      logger.warn('Empty or invalid webhook payload');
      return res.status(400).json({ error: 'Invalid message' });
    }

    logger.debug('Received message:', { from: rawMessage.from, type: rawMessage.type });

    // Process message
    const processedMessage = MessageProcessor.process({
      from: rawMessage.from,
      text: rawMessage.text,
      timestamp: rawMessage.timestamp
    });

    // Detect language from first message
    const userLanguage = aiEngine.detectLanguage(rawMessage.text || '');

    // Ensure user exists in DB
    let user = await User.findOne({ phone: rawMessage.from });
    let isNewUser = false;
    let skipName = false;
    
    if (!user) {
      const hasSenderName = !!rawMessage.senderName && rawMessage.senderName.trim() !== '';
      user = new User({
        phone: rawMessage.from,
        name: rawMessage.senderName || 'User',
        nameAutoFilled: hasSenderName,
        onboardingCompleted: false,
        onboardingStep: hasSenderName ? 0 : 0, // Start at 0 regardless, but skip name question if auto-filled
        preferredLanguage: userLanguage  // Set language from first message
      });
      await user.save();
      skipName = hasSenderName; // Skip name question if it was auto-filled
      isNewUser = true;
      logger.info('🆕 New user created:', { userId: user._id, phone: rawMessage.from, language: userLanguage, nameAutoFilled: hasSenderName });
    } else {
      skipName = user.nameAutoFilled || false;
      logger.debug('👤 Existing user found:', {
        userId: user._id,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        userType: user.userType,
        nameAutoFilled: user.nameAutoFilled
      });
    }

    // Update user metadata
    user.metadata.lastMessageAt = new Date();
    user.metadata.totalMessages = (user.metadata.totalMessages || 0) + 1;
    await user.save();

    // ============ ONBOARDING FLOW ============
    if (user.onboardingCompleted) {
      // 🟢 Onboarding is complete - skip to normal message processing
      logger.warn('⏭️  SKIPPING ONBOARDING (Already Complete):', {
        userId: user._id,
        onboardingStep: user.onboardingStep,
        userType: user.userType
      });
    } else {
      // ============ ONBOARDING PROCESSING ============
      logger.warn('📝 ONBOARDING FLOW ENTERED:', { 
        userId: user._id, 
        phone: rawMessage.from,
        isNewUser,
        currentStep: user.onboardingStep,
        currentOnboardingCompleted: user.onboardingCompleted 
      });
      
      if (isNewUser) {
        // First message - send warm welcome + first question combined in ONE message
        const firstQuestion = OnboardingService.getFirstQuestion(user.preferredLanguage, skipName);
        
        let welcomeWithQuestion = '';
        if (user.preferredLanguage === 'hindi') {
          welcomeWithQuestion = '🎉 LifeOS में स्वागत है!\n\nमैं आपका personal AI assistant हूँ - और मैं आपको अपनी life को organize करने में मदद करूँगा। \n\n' + firstQuestion;
        } else if (user.preferredLanguage === 'hinglish') {
          welcomeWithQuestion = '🎉 LifeOS mein aapka swagat hai!\n\nMain aapka personal AI assistant hoon - aur main aapko apni life ko organize karne mein madad karunga. \n\n' + firstQuestion;
        } else {
          // English (default)
          welcomeWithQuestion = '🎉 Welcome to LifeOS!\n\nI\'m your personal AI assistant - and I\'m here to help you organize your life.\n\n' + firstQuestion;
        }
        
        // Send SINGLE combined message with welcome + first question
        await whatsappService.sendMessage(rawMessage.from, welcomeWithQuestion);
        
        logger.info('Sent welcome + first onboarding question combined:', { userId: user._id, language: user.preferredLanguage, nameAutoFilled: skipName });
        return res.status(200).json({
          success: true,
          messageId: rawMessage.messageId,
          mode: 'onboarding',
          step: 'question'
        });
      } else {
        // Process onboarding response
        try {
          const onboardingResult = await OnboardingService.processResponse(user._id, processedMessage.text);
          logger.debug('Onboarding result:', { 
            completed: onboardingResult.completed, 
            step: onboardingResult.step,
            userTypeFromService: onboardingResult.userType
          });
          
          if (onboardingResult.completed) {
            // ✅ ONBOARDING IS COMPLETE - Refresh user from database
            user = await User.findById(user._id);
            logger.info('✅ ONBOARDING COMPLETED:', { 
              userId: user._id, 
              onboardingCompleted: user.onboardingCompleted,
              userType: user.userType
            });
            
            // Warm completion message based on user type AND language priority
            const userName = user.name || 'Friend';
            const lang = aiEngine.detectLanguage(processedMessage.text);
            
            let completionMsg = '';
            if (user.userType === 'business') {
              // Priority: English > Hinglish > Hindi
              if (lang === 'hindi') {
                completionMsg = `🎉 शानदार, ${userName}! आपकी business profile तैयार है!\n\nअब मैं आपके लिए एक personal business assistant की तरह काम करूँगा। clients, invoices, meetings को track करने में मदद दूँगा। बस कुछ भी कहो! 💼`;
              } else if (lang === 'hinglish') {
                completionMsg = `🎉 Awesome, ${userName}! Aapka business profile ready ho gaya!\n\nAb main aapka personal business assistant hoon. Clients, invoices, meetings ko track karunga. Bas kuch bhi bolna! 💼`;
              } else {
                // English (default/priority)
                completionMsg = `🎉 Awesome, ${userName}! Your business profile is ready!\n\nNow I'll act as your personal business assistant. I'll help you track clients, invoices, and meetings. Just ask me anything! 💼`;
              }
            } else {
              // Priority: English > Hinglish > Hindi
              if (lang === 'hindi') {
                completionMsg = `🎉 शानदार, ${userName}! तुम्हारा profile तैयार है!\n\nअब मैं तुम्हारे goals, reminders, और daily routine को manage करने में मदद दूँगा। बस कहो कि तुम क्या चाहते हो! 🚀`;
              } else if (lang === 'hinglish') {
                completionMsg = `🎉 Awesome, ${userName}! Aapka profile ready ho gaya!\n\nAb main aapke goals, reminders, aur routine ko manage karunga. Bas batao kya chahiye! 🚀`;
              } else {
                // English (default/priority)
                completionMsg = `🎉 Awesome, ${userName}! Your profile is ready!\n\nNow I'll help manage your goals, reminders, and daily routine. Just tell me what you need! 🚀`;
              }
            }
            
            await whatsappService.sendMessage(rawMessage.from, completionMsg);
            await ContextEngine.addMessage(user._id, 'user', processedMessage.text);
            
            return res.status(200).json({
              success: true,
              messageId: rawMessage.messageId,
              mode: 'onboarding',
              step: onboardingResult.step,
              completed: true
            });
          } else if (onboardingResult.nextQuestion) {
            await whatsappService.sendMessage(rawMessage.from, onboardingResult.nextQuestion);
          } else {
            // Fallback: send acknowledgement if no next question
            const lang = user.preferredLanguage;
            let fallbackMsg = '';
            if (lang === 'hindi') {
              fallbackMsg = '✅ धन्यवाद! अगला सवाल अभी आ रहा है... 💭';
            } else if (lang === 'hinglish') {
              fallbackMsg = '✅ Thanks! Agle sawaal aa raha hai... 💭';
            } else {
              fallbackMsg = '✅ Got it! Next question coming up... 💭';
            }
            await whatsappService.sendMessage(rawMessage.from, fallbackMsg);
          }
          
          // Store in conversation
          await ContextEngine.addMessage(user._id, 'user', processedMessage.text);
          
          logger.info('Onboarding response processed:', { userId: user._id, step: onboardingResult.step });
          return res.status(200).json({
            success: true,
            messageId: rawMessage.messageId,
            mode: 'onboarding',
            step: onboardingResult.step,
            completed: onboardingResult.completed
          });
        } catch (error) {
          logger.error('Onboarding processing error:', error.message, error.stack);
          await whatsappService.sendMessage(rawMessage.from, 'कृपया फिर से कोशिश करें। (Please try again)');
          return res.status(200).json({
            success: false,
            messageId: rawMessage.messageId,
            error: error.message
          });
        }
      }
    }
    // ============ END ONBOARDING FLOW ============

    // Check for due reminders/routines (Vercel-friendly scheduler)
    try {
      await onDemandScheduler.checkAndSendDueReminders(user._id);
      await onDemandScheduler.checkAndSendDueRoutines(user._id);
    } catch (error) {
      logger.warn('On-demand scheduler check failed:', error.message);
    }

    // Get or create context
    const context = await ContextEngine.getContext(user._id);

    // Add user message to conversation
    await ContextEngine.addMessage(user._id, 'user', processedMessage.text);

    // Check for UPDATE_NAME intent (pattern-based, before AI)
    const messageText = processedMessage.text.toLowerCase();
    
    // Check for QUERY_REMINDERS intent (pattern-based)
    const queryReminderPatterns = [
      /(?:show|list|display|tell|give)\s+(?:me\s+)?(?:my\s+)?reminders/i,
      /kya\s+reminders\s+set\s+hain/i,                                  // Hindi: "kya reminders set hain"
      /meri\s+reminders\s+(?:kya\s+)?hain/i,                           // Hindi: "meri reminders [kya] hain"
      /reminders?\s+(?:bata|dikhao|batao)/i,                           // Hinglish variants
      /kitne\s+reminders?\s+(?:set\s+)?hain/i,                          // Hindi: "kitne reminders set hain"
      /remind(?:ers?)?\s+(?:list|dikhao|show)/i                        // Mixed variants
    ];

    let hasQueryRemindersMatch = false;
    for (const pattern of queryReminderPatterns) {
      if (pattern.test(messageText)) {
        hasQueryRemindersMatch = true;
        break;
      }
    }
    
    const nameUpdatePatterns = [
      /(?:call|name)\s+me\s+(.+)/i,
      /my\s+name\s+(?:is|should be)\s+(.+)/i,
      /bulao\s+mujhe\s+(.+)/i,                    // Hindi: "bulao mujhe [name]"
      /mera\s+naam\s+(.+)(?:\s+h|$)/i,           // Hindi: "mera naam [name] hai"
      /rename\s+me\s+(?:to\s+)?(.+)/i,
      /change\s+my\s+name\s+to\s+(.+)/i,
      /mujhe\s+(.+)\s+bolao/i,                    // Hinglish: "[name] bolao"
      /call\s+me\s+(.+)\s+(?:from now|aage se)?/i
    ];

    let updateNameMatch = null;
    for (const pattern of nameUpdatePatterns) {
      const match = messageText.match(pattern);
      if (match && match[1]) {
        updateNameMatch = match[1].trim();
        break;
      }
    }

    // Detect intent using AI (Groq)
    let aiResult;
    try {
      aiResult = await aiEngine.detectIntent(processedMessage.text, {
        lastActivity: context.context.lastActivity,
        missedActivities: context.context.missedActivities
      });

      // Override intent if name update pattern matched
      if (updateNameMatch) {
        aiResult.intent = 'UPDATE_NAME';
        aiResult.activity = updateNameMatch;
        aiResult.confidence = 0.95;
        logger.info('🔤 UPDATE_NAME detected via pattern:', { newName: updateNameMatch });
      }
      
      // Override intent if reminders query pattern matched
      if (hasQueryRemindersMatch) {
        aiResult.intent = 'QUERY_REMINDERS';
        aiResult.confidence = 0.95;
        logger.info('📋 QUERY_REMINDERS detected via pattern');
      }
    } catch (error) {
      logger.warn('AI detection failed, defaulting to CHAT:', error.message);
      aiResult = {
        intent: updateNameMatch ? 'UPDATE_NAME' : (hasQueryRemindersMatch ? 'QUERY_REMINDERS' : 'CHAT'),
        confidence: updateNameMatch ? 0.95 : (hasQueryRemindersMatch ? 0.95 : 0.5),
        entities: {},
        activity: updateNameMatch || null
      };
    }

    // Setup service handlers
    const handlers = {
      reminderService: {
        createReminder: async (entities) => {
          try {
            // Check for incomplete reminder (missing activity or time)
            const activity = entities?.activity || '';
            const datetime = entities?.datetime || entities?.time || '';
            
            const activityMissing = !activity || activity.toLowerCase() === 'reminder' || activity.toLowerCase() === 'unknown' || activity.toLowerCase() === 'none';
            const timeMissing = !datetime || datetime.toLowerCase() === 'now' || datetime.toLowerCase() === 'unknown' || datetime.toLowerCase() === 'none';
            
            // If critical info is missing, ask for clarification
            if (activityMissing || timeMissing) {
              logger.info('⚠️ Incomplete reminder detected - asking for clarification:', {
                activity: activity || 'missing',
                datetime: datetime || 'missing'
              });
              
              const lang = aiEngine.detectLanguage(processedMessage.text);
              let clarificationMsg = '';
              
              if (lang === 'hindi') {
                if (activityMissing && timeMissing) {
                  clarificationMsg = '🤔 Mujhe samajh nahi aaya! Batao:\n1️⃣ Kis chiz ke liye reminder chahiye?\n2️⃣ Kab reminder dena hai?';
                } else if (activityMissing) {
                  clarificationMsg = `🤔 Kaunsi chiz ke liye reminder set karvana hai?`;
                } else {
                  clarificationMsg = `💭 Kis time par reminder dena chahiye? (e.g., 2:30 PM ya "agle 30 minutes")`;
                }
              } else if (lang === 'hinglish') {
                if (activityMissing && timeMissing) {
                  clarificationMsg = '🤔 Mujhe samajh nahi aaya! Batao:\n1️⃣ Kis chiz ke liye reminder chahiye?\n2️⃣ Kab reminder dena hai?';
                } else if (activityMissing) {
                  clarificationMsg = `🤔 Kis cheez ke liye reminder set karna hai?`;
                } else {
                  clarificationMsg = `💭 Kis waqt par reminder de du? (e.g., 2:30 PM ya "next 30 minutes")`;
                }
              } else {
                if (activityMissing && timeMissing) {
                  clarificationMsg = '🤔 I need more details!\n1️⃣ What should I remind you about?\n2️⃣ When should I remind you?';
                } else if (activityMissing) {
                  clarificationMsg = `🤔 What should I remind you about?`;
                } else {
                  clarificationMsg = `💭 When should I remind you? (e.g., 2:30 PM or "in 30 minutes")`;
                }
              }
              
              await whatsappService.sendMessage(rawMessage.from, clarificationMsg);
              return { success: false, incomplete: true, error: 'Missing activity or time' };
            }
            
            // Parse time string to datetime if needed
            let reminderDateTime = entities.datetime || entities.time;
            
            logger.debug('Creating reminder with entities:', {
              entities: JSON.stringify(entities),
              rawDateTime: reminderDateTime
            });
            
            if (typeof reminderDateTime === 'string') {
              // Parse time string like "09:00", "2:30 PM", "tomorrow 9 AM" etc
              logger.info('🔍 Attempting to parse time string:', {
                input: reminderDateTime,
                source: entities.datetime ? 'datetime' : 'time'
              });
              reminderDateTime = parseTimeToDateTime(reminderDateTime);
              logger.info('⏰ Time parsing result:', {
                input: entities.datetime || entities.time,
                parsed: reminderDateTime,
                isValid: !!reminderDateTime && typeof reminderDateTime === 'string'
              });
            }
            
            // If parsing failed, log the problem and ask user to clarify
            if (!reminderDateTime || typeof reminderDateTime !== 'string') {
              logger.error('❌ Time parsing failed - using fallback:', {
                entities,
                reason: 'Could not extract valid time'
              });
              
              // Bug Fix: Use Kolkata time for fallback, not Vercel server local time (UTC)
              const nowUtc = new Date();
              let kYear = nowUtc.getUTCFullYear();
              let kMonth = nowUtc.getUTCMonth() + 1; // 1-based
              let kDay = nowUtc.getUTCDate();
              let kHours = nowUtc.getUTCHours() + 5;
              let kMinutes = nowUtc.getUTCMinutes() + 30 + 5; // Add 5 minutes for fallback
              
              // Handle minute/hour overflow
              if (kMinutes >= 60) { kHours += 1; kMinutes -= 60; }
              if (kHours >= 24) {
                kHours -= 24;
                kDay += 1;
                const daysInKMonth = new Date(Date.UTC(kYear, kMonth, 0)).getUTCDate();
                if (kDay > daysInKMonth) { kDay = 1; kMonth += 1; }
                if (kMonth > 12) { kMonth = 1; kYear += 1; }
              }

              const monthStr = String(kMonth).padStart(2, '0');
              const dayStr = String(kDay).padStart(2, '0');
              const hourStr = String(kHours).padStart(2, '0');
              const minuteStr = String(kMinutes).padStart(2, '0');
              reminderDateTime = `${kYear}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00+05:30`;
              
              logger.warn('⚠️ Using IST fallback reminder time (5 mins from now):', {
                fallbackTime: reminderDateTime,
                entities: JSON.stringify(entities)
              });
            }
            
            const reminder = await ReminderService.createReminder(user._id, {
              activity: entities.activity || 'Reminder',
              title: entities.activity || 'Reminder',
              datetime: reminderDateTime,
              repeat: entities.repeat || 'none',
              priority: entities.priority || 'medium',
              description: entities.description
            });
            logger.info('✅ Reminder created:', { 
              reminderId: reminder._id, 
              title: reminder.title,
              datetime: reminderDateTime
            });
            return { success: true, data: reminder };
          } catch (error) {
            logger.error('Failed to create reminder:', error.message);
            return { success: false, error: error.message };
          }
        },
        updateReminder: async (entities) => {
          try {
            const reminder = await ReminderService.updateReminder(entities.reminderId, entities);
            return { success: true, data: reminder };
          } catch (error) {
            logger.error('Failed to update reminder:', error.message);
            return { success: false };
          }
        },
        deleteReminder: async (entities) => {
          try {
            await ReminderService.deleteReminder(entities.reminderId);
            return { success: true };
          } catch (error) {
            logger.error('Failed to delete reminder:', error.message);
            return { success: false };
          }
        }
      },

      activityService: {
        logActivity: async (entities) => {
          try {
            const activity = await ActivityService.logActivity(
              user._id,
              entities.activity || 'Activity',
              entities.status || 'done',
              {
                date: entities.date,
                duration: entities.duration,
                notes: entities.notes
              }
            );
            logger.info('Activity logged:', { activityId: activity._id });
            return { success: true, data: activity };
          } catch (error) {
            logger.error('Failed to log activity:', error.message);
            return { success: false };
          }
        }
      },

      routineService: {
        createRoutine: async (entities) => {
          try {
            // Check for incomplete routine (missing activity or time)
            const activity = entities?.activity || '';
            const time = entities?.time || '';
            
            const activityMissing = !activity || activity.toLowerCase() === 'routine' || activity.toLowerCase() === 'unknown' || activity.toLowerCase() === 'null' || activity.toLowerCase() === 'none';
            const timeMissing = !time || time.toLowerCase() === 'now' || time.toLowerCase() === 'unknown' || time.toLowerCase() === 'null' || time.toLowerCase() === 'none';
            
            // If critical info is missing, ask for clarification
            if (activityMissing || timeMissing) {
              logger.info('⚠️ Incomplete routine detected - asking for clarification:', {
                activity: activity || 'missing',
                time: time || 'missing'
              });
              
              const lang = aiEngine.detectLanguage(processedMessage.text);
              let clarificationMsg = '';
              
              if (lang === 'hindi') {
                if (activityMissing && timeMissing) {
                  clarificationMsg = '🤔 मैं आपकी क्या रूटीन सेट करूँ?\n1️⃣ कौनसी गतिविधि है?\n2️⃣ किस समय (e.g., सुबह 7 बजे)?';
                } else if (activityMissing) {
                  clarificationMsg = `🤔 कौनसी गतिविधि की रूटीन सेट करनी है?`;
                } else {
                  clarificationMsg = `💭 यह रूटीन रोज़ किस समय करनी है? (e.g., 7:00 AM)`;
                }
              } else if (lang === 'hinglish') {
                if (activityMissing && timeMissing) {
                  clarificationMsg = '🤔 Main aapki kya routine set karu?\n1️⃣ Konsi activity hai?\n2️⃣ Kis time par (e.g., subah 7 baje)?';
                } else if (activityMissing) {
                  clarificationMsg = `🤔 Konsi activity ki routine set karni hai?`;
                } else {
                  clarificationMsg = `💭 Yeh routine roz kis waqt karni hai? (e.g., 7:00 AM)`;
                }
              } else {
                if (activityMissing && timeMissing) {
                  clarificationMsg = '🤔 I need more details for your routine!\n1️⃣ What is the activity?\n2️⃣ What time should it happen?';
                } else if (activityMissing) {
                  clarificationMsg = `🤔 What activity should this routine be for?`;
                } else {
                  clarificationMsg = `💭 At what time should this routine happen daily? (e.g., 7:00 AM)`;
                }
              }
              
              await whatsappService.sendMessage(rawMessage.from, clarificationMsg);
              return { success: false, incomplete: true, error: 'Missing activity or time for routine' };
            }

            const routine = await RoutineService.createRoutine(user._id, {
              activity: activity,
              schedule: entities.schedule || 'daily',
              time: time,
              daysOfWeek: entities.daysOfWeek,
              description: entities.description
            });
            logger.info('Routine created:', { routineId: routine._id });
            return { success: true, data: routine };
          } catch (error) {
            logger.error('Failed to create routine:', error.message);
            return { success: false };
          }
        },
        updateRoutine: async (entities) => {
          try {
            const routine = await RoutineService.updateRoutine(entities.routineId, entities);
            return { success: true, data: routine };
          } catch (error) {
            logger.error('Failed to update routine:', error.message);
            return { success: false };
          }
        },
        queryRoutine: async (entities) => {
          try {
            const routines = await RoutineService.getUserRoutines(user._id);
            return { success: true, data: routines };
          } catch (error) {
            logger.error('Failed to query routines:', error.message);
            return { success: false };
          }
        }
      },

      userService: {
        updateName: async (entities) => {
          try {
            const newName = entities.activity || entities.name;
            if (!newName || newName.trim() === '') {
              return { success: false, error: 'Name cannot be empty' };
            }
            
            user.name = newName.trim();
            user.nameAutoFilled = false; // Mark as user-provided
            await user.save();
            
            logger.info('User name updated:', { userId: user._id, newName: user.name });
            return { success: true, data: { name: user.name } };
          } catch (error) {
            logger.error('Failed to update name:', error.message);
            return { success: false, error: error.message };
          }
        },
        deleteReminder: async (entities) => {
          try {
            await ReminderService.deleteReminder(entities.reminderId);
            return { success: true };
          } catch (error) {
            logger.error('Failed to delete reminder:', error.message);
            return { success: false };
          }
        },
        queryReminders: async (entities) => {
          try {
            const reminders = await ReminderService.getActiveReminders(user._id);
            const routines = await RoutineService.getUserRoutines(user._id);
            
            const totalCount = (reminders?.length || 0) + (routines?.length || 0);
            
            if (totalCount === 0) {
              return {
                success: true,
                data: {
                  count: 0,
                  reminders: [],
                  formatted: 'No reminders set yet'
                }
              };
            }
            
            // Categorize reminders
            const daily = reminders.filter(r => r.repeat === 'daily');
            const oneTime = reminders.filter(r => r.repeat === 'none' || !r.repeat);
            const weekly = reminders.filter(r => r.repeat === 'weekly');
            const monthly = reminders.filter(r => r.repeat === 'monthly');
            
            // Format for user display
            let formattedList = '';
            const lang = aiEngine.detectLanguage(processedMessage.text);
            
            if (lang === 'hindi') {
              formattedList = `📋 **आपके Reminders & Routines** (कुल: ${totalCount})\n\n`;
              
              if (routines && routines.length > 0) {
                formattedList += `📅 **दिनचर्या (Routines):**\n`;
                routines.forEach((r, i) => {
                  formattedList += `${i + 1}. ${r.activity} @ ${r.time}\n`;
                });
                formattedList += '\n';
              }
              
              if (daily.length > 0) {
                formattedList += `🔁 **रोज़:**\n`;
                daily.forEach((r, i) => {
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `${(routines?.length || 0) + i + 1}. ${r.title} @ ${time}\n`;
                });
                formattedList += '\n';
              }
              
              if (oneTime.length > 0) {
                formattedList += `⏰ **एक बार:**\n`;
                oneTime.forEach((r, i) => {
                  const date = r.datetime.split('T')[0];
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `${i + 1}. ${r.title} @ ${time} (${date})\n`;
                });
                formattedList += '\n';
              }
              
              if (weekly.length > 0) {
                formattedList += `📅 **साप्ताहिक:**\n`;
                weekly.forEach((r, i) => {
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `- ${r.title} @ ${time}\n`;
                });
              }
            } else if (lang === 'hinglish') {
              formattedList = `📋 **Aapki Reminders & Routines** (Total: ${totalCount})\n\n`;
              
              if (routines && routines.length > 0) {
                formattedList += `📅 **Routines:**\n`;
                routines.forEach((r, i) => {
                  formattedList += `${i + 1}. ${r.activity} @ ${r.time}\n`;
                });
                formattedList += '\n';
              }
              
              if (daily.length > 0) {
                formattedList += `🔁 **Daily:**\n`;
                daily.forEach((r, i) => {
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `${i + 1}. ${r.title} @ ${time}\n`;
                });
                formattedList += '\n';
              }
              
              if (oneTime.length > 0) {
                formattedList += `⏰ **One-time:**\n`;
                oneTime.forEach((r, i) => {
                  const date = r.datetime.split('T')[0];
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `${i + 1}. ${r.title} @ ${time} (${date})\n`;
                });
                formattedList += '\n';
              }
              
              if (weekly.length > 0) {
                formattedList += `📅 **Weekly:**\n`;
                weekly.forEach((r, i) => {
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `- ${r.title} @ ${time}\n`;
                });
              }
            } else {
              formattedList = `📋 **Your Reminders & Routines** (Total: ${totalCount})\n\n`;
              
              if (routines && routines.length > 0) {
                formattedList += `📅 **Routines:**\n`;
                routines.forEach((r, i) => {
                  formattedList += `${i + 1}. ${r.activity} @ ${r.time}\n`;
                });
                formattedList += '\n';
              }
              
              if (daily.length > 0) {
                formattedList += `🔁 **Daily:**\n`;
                daily.forEach((r, i) => {
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `${i + 1}. ${r.title} @ ${time}\n`;
                });
                formattedList += '\n';
              }
              
              if (oneTime.length > 0) {
                formattedList += `⏰ **One-time:**\n`;
                oneTime.forEach((r, i) => {
                  const date = r.datetime.split('T')[0];
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `${i + 1}. ${r.title} @ ${time} (${date})\n`;
                });
                formattedList += '\n';
              }
              
              if (weekly.length > 0) {
                formattedList += `📅 **Weekly:**\n`;
                weekly.forEach((r, i) => {
                  const time = r.datetime.match(/T(\d{2}:\d{2})/)?.[1] || 'unknown';
                  formattedList += `- ${r.title} @ ${time}\n`;
                });
              }
            }
            
            logger.info('Reminders and Routines queried:', {
              userId: user._id,
              totalReminders: reminders?.length || 0,
              totalRoutines: routines?.length || 0,
              daily: daily.length,
              oneTime: oneTime.length,
              weekly: weekly.length
            });
            
            return {
              success: true,
              data: {
                count: totalCount,
                daily: daily.length,
                oneTime: oneTime.length,
                weekly: weekly.length,
                reminders,
                formatted: formattedList
              }
            };
          } catch (error) {
            logger.error('Failed to query reminders:', error.message);
            return { success: false, error: error.message };
          }
        }
      }
    };

    // Route to appropriate handler
    let routeResult = {};
    try {
      // Include activity and time from AIEngine in entities for handlers
      const enrichedEntities = {
        ...aiResult.entities,
        activity: aiResult.activity,
        datetime: aiResult.time || undefined,
        time: aiResult.time || undefined
      };
      
      logger.info('🔄 Routing intent with enriched entities:', {
        intent: aiResult.intent,
        activity: aiResult.activity,
        time: aiResult.time,
        entities: JSON.stringify(enrichedEntities)
      });
      
      routeResult = await IntentRouter.route(aiResult.intent, enrichedEntities, handlers);
      
      // If the handler flagged the request as incomplete (e.g., missing time/activity),
      // it has already sent a clarification message to the user. We should STOP here
      // instead of generating a generic AI response.
      if (routeResult && routeResult.incomplete) {
        logger.info('🛑 Request is incomplete. Handler already sent clarification. Stopping generic response flow.');
        return res.status(200).json({ status: 'ok', handled: 'incomplete' });
      }
    } catch (error) {
      logger.warn('Route handling failed:', error.message);
    }

    // Generate response using AI (Groq)
    let responseText;
    try {
      // Include user profile in context for personalization
      const contextWithProfile = {
        ...context.context,
        userProfile: {
          name: user.name,
          userType: user.userType,
          dailyActivities: user.dailyActivities,
          hobbies: user.hobbies,
          workSchedule: user.workSchedule,
          reminderPreferences: user.reminderPreferences,
          businessProfile: user.businessProfile
        }
      };

      responseText = await aiEngine.generateResponse(
        aiResult.intent,
        {
          ...aiResult.entities,
          activity: aiResult.activity,  // ← Pass top-level activity
          time: aiResult.time            // ← Pass top-level time
        },
        contextWithProfile,
        processedMessage.text,
        routeResult
      );
    } catch (error) {
      logger.warn('Response generation failed, using fallback:', error.message);
      
      // Generate language-aware fallback response
      const lang = aiEngine.detectLanguage(processedMessage.text);
      if (lang === 'hindi') {
        responseText = 'कुछ गलती हुई 😅 फिर से कोशिश करो।';
      } else if (lang === 'hinglish') {
        responseText = 'Kuch error ho gaya 😅. Phir se try karo na.';
      } else {
        responseText = 'Oops! Something went wrong. Let me try again.';
      }
    }

    // Send response back to user
    try {
      await whatsappService.sendMessage(rawMessage.from, responseText);
    } catch (error) {
      logger.error('Failed to send WhatsApp message:', error.message);
    }

    // Store assistant response in conversation
    await ContextEngine.addMessage(user._id, 'assistant', responseText);

    logger.info('Message processed successfully:', {
      userId: user._id,
      phone: rawMessage.from,
      intent: aiResult.intent,
      confidence: aiResult.confidence
    });

    res.status(200).json({
      success: true,
      intent: aiResult.intent,
      messageId: rawMessage.messageId
    });

  } catch (error) {
    logger.error('Webhook processing error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to process message',
      message: error.message
    });
  }
});

/**
 * GET /webhook/whatsapp
 * Webhook verification endpoint (for webhook providers that require GET verification)
 */
/**
 * GET /webhook/whatsapp
 * Webhook verification endpoint
 */
router.get('/whatsapp', (req, res) => {
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const webhookSecret = process.env.ELEVENZA_WEBHOOK_SECRET;

  logger.debug('Webhook verification attempt', { hasToken: !!token, hasChallenge: !!challenge });

  if (webhookSecret && token === webhookSecret) {
    logger.info('✅ Webhook verified successfully');
    res.send(challenge || 'verified');
  } else if (!webhookSecret) {
    logger.warn('⚠️ ELEVENZA_WEBHOOK_SECRET not configured');
    res.status(200).send('OK');
  } else {
    logger.warn('❌ Invalid webhook verification token');
    res.status(200).send('OK');
  }
});

/**
 * GET /webhook/test
 * Test endpoint to verify webhook URL is accessible
 */
router.get('/test', (req, res) => {
  logger.info('🧪 TEST GET ENDPOINT - Webhook URL is accessible');
  res.status(200).json({
    status: 'success',
    message: 'Webhook URL is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    webhookSecret: process.env.ELEVENZA_WEBHOOK_SECRET ? '✅ Configured' : '❌ Not configured'
  });
});

/**
 * POST /webhook/test
 * Test POST endpoint for webhook testing
 */
router.post('/test', (req, res) => {
  logger.info('🧪 TEST POST ENDPOINT HIT', {
    hasApiKey: !!req.headers['x-api-key'],
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  res.status(200).json({
    status: 'received',
    message: 'Test webhook POST received',
    receivedAt: new Date().toISOString(),
    apiKeyValid: req.headers['x-api-key'] === process.env.ELEVENZA_WEBHOOK_SECRET,
    headers: req.headers
  });
});

/**
 * GET /webhook/debug/reminders
 * Debug endpoint to check what reminders exist in database
 */
router.get('/debug/reminders', async (req, res) => {
  try {
    await connectDB();
    
    const reminders = await Reminder.find({}).populate('userId', 'name phone').lean();
    
    const now = new Date();
    const reminderStats = reminders.map(r => ({
      id: r._id,
      title: r.title,
      description: r.description,
      datetime: r.datetime,
      notified: r.notified,
      status: r.status,
      repeat: r.repeat,
      priority: r.priority,
      user: r.userId ? { _id: r.userId._id, name: r.userId.name, phone: r.userId.phone } : null,
      minutesDifference: ((now - new Date(r.datetime)) / 60000).toFixed(2),
      isWithinWindow: ((now - new Date(r.datetime)) / 60000) >= -2 && ((now - new Date(r.datetime)) / 60000) <= 1
    }));

    res.status(200).json({
      currentTime: now.toISOString(),
      totalReminders: reminders.length,
      activeReminders: reminders.filter(r => r.status === 'active' && !r.notified).length,
      reminders: reminderStats
    });
  } catch (error) {
    logger.error('Debug endpoint error:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /webhook/debug/trigger-status
 * Check if the trigger-reminders endpoint can be called and runs properly
 */
router.get('/debug/trigger-status', async (req, res) => {
  try {
    await connectDB();
    
    res.status(200).json({
      status: 'ready',
      message: 'Cron trigger endpoint is ready',
      endpoint: 'POST /webhook/trigger-reminders',
      node_env: process.env.NODE_ENV,
      onDemandSchedulerReady: !!onDemandScheduler,
      timestamp: new Date().toISOString(),
      instructions: [
        'On Vercel: Use external cron service (cron-job.org, EasyCron) to POST to /api/webhook/trigger-reminders every 1-5 minutes',
        'Locally: Run with "npm start" to start ReminderScheduler automatically',
        'Test: POST /api/webhook/trigger-reminders to manually trigger reminder check'
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /webhook/debug/test-reminder
 * Test endpoint to manually create and trigger a reminder
 * Useful for testing reminder creation and sending logic
 */
router.post('/debug/test-reminder', async (req, res) => {
  try {
    await connectDB();
    
    const { userId, title, timeStr } = req.body;
    
    if (!userId || !title || !timeStr) {
      return res.status(400).json({
        error: 'Missing required fields: userId, title, timeStr',
        example: {
          userId: 'user_id_from_db',
          title: 'Test Reminder',
          timeStr: 'in 2 minutes'
        }
      });
    }

    // Parse the time string
    const reminderDateTime = parseTimeToDateTime(timeStr);
    
    if (!reminderDateTime) {
      return res.status(400).json({
        error: 'Could not parse time string',
        input: timeStr,
        currentTime: new Date().toISOString()
      });
    }

    logger.info('🧪 Creating test reminder:', {
      userId,
      title,
      timeStr,
      parsedDateTime: reminderDateTime
    });

    // Create reminder
    const reminder = new Reminder({
      userId,
      title,
      datetime: reminderDateTime,
      repeat: 'none',
      status: 'active',
      priority: 'high'
    });

    await reminder.save();

    res.status(200).json({
      success: true,
      reminder: {
        _id: reminder._id,
        title: reminder.title,
        datetime: reminder.datetime,
        status: reminder.status,
        notified: reminder.notified,
        createdAt: reminder.createdAt.toISOString()
      },
      message: 'Test reminder created. Cron will pick it up automatically.',
      currentTime: new Date().toISOString(),
      timeUntilReminder: {
        seconds: ((reminder.datetime - new Date()) / 1000).toFixed(0),
        minutes: ((reminder.datetime - new Date()) / 60000).toFixed(2)
      }
    });
  } catch (error) {
    logger.error('Test reminder creation failed:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
