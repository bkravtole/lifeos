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
import GoalService from '../services/GoalService.js';
import MemoryService from '../services/MemoryService.js';
import ContactService from '../services/ContactService.js';
import User from '../models/User.js';
import Reminder from '../models/Reminder.js';
import logger from '../utils/logger.js';
import { connectDB } from '../utils/database.js';
import { parseTimeInKolkata, formatTimeInKolkata, getCurrentTimeInKolkata } from '../utils/timezone.js';

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

    // ============ VOICE NOTE HANDLING ============
    // If user sent a voice note, download and transcribe it before processing
    if (rawMessage.type === 'voice' && rawMessage.mediaUrl) {
      logger.info('🎙️ Voice note received, downloading audio...', { from: rawMessage.from, url: rawMessage.mediaUrl });
      try {
        const audioBuffer = await whatsappService.downloadMedia(rawMessage.mediaUrl);
        if (audioBuffer) {
          // Extract filename from URL for proper extension handling
          const urlParts = rawMessage.mediaUrl.split('/');
          const filename = urlParts[urlParts.length - 1] || 'voice_note.ogg';
          
          const transcribedText = await aiEngine.transcribeAudio(audioBuffer, filename);
          if (transcribedText && transcribedText.trim()) {
            logger.info('🎧 Voice transcription result:', { text: transcribedText, from: rawMessage.from });
            // Inject transcribed text back into rawMessage so the rest of the pipeline works unchanged
            rawMessage.text = transcribedText.trim();
            rawMessage.type = 'text'; // Treat as text from here onwards
          } else {
            logger.warn('⚠️ Voice transcription returned empty text');
            await whatsappService.sendMessage(rawMessage.from, '🎙️ Sorry, I could not understand your voice message. Please try again or type your message.');
            return res.status(200).json({ success: true, messageId: rawMessage.messageId, note: 'voice_transcription_empty' });
          }
        } else {
          logger.error('❌ Failed to download voice note audio');
          await whatsappService.sendMessage(rawMessage.from, '🎙️ Sorry, I could not process your voice message. Please try sending it again.');
          return res.status(200).json({ success: true, messageId: rawMessage.messageId, note: 'voice_download_failed' });
        }
      } catch (voiceError) {
        logger.error('❌ Voice note processing failed:', voiceError.message);
        await whatsappService.sendMessage(rawMessage.from, '🎙️ Sorry, something went wrong processing your voice message. Please type your message instead.');
        return res.status(200).json({ success: true, messageId: rawMessage.messageId, note: 'voice_processing_error' });
      }
    }

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
      // Check for pending action (multi-turn logic)
      const pendingAction = context.context?.pendingAction;
      const isPendingValid = pendingAction && (Date.now() - new Date(pendingAction.startedAt).getTime() < 15 * 60 * 1000); // 15 min expiry
      
      const lastAssistantMessage = context.messages && Array.isArray(context.messages) 
        ? context.messages.slice().reverse().find(m => m.role === 'assistant')?.content 
        : null;

      aiResult = await aiEngine.detectIntent(processedMessage.text, {
        lastActivity: context.context.lastActivity,
        missedActivities: context.context.missedActivities,
        lastAssistantMessage: lastAssistantMessage
      });

      // GREETING CHECK: If simple greeting, clear status instead of merging
      const lowerText = processedMessage.text.toLowerCase().trim();
      const isGreeting = ['hi', 'hello', 'hey', 'hii', 'hiii', 'hola', 'nameste', 'namaste'].some(g => lowerText === g);
      const isCancel = ['cancel', 'stop', 'abort', 'leave', 'exit', 'niklo', 'band karo'].some(c => lowerText === c);
      
      if ((isGreeting || isCancel) && isPendingValid) {
        logger.info('👋 Greeting/Cancel detected during pending flow - clearing status');
        await ContextEngine.clearPendingAction(user._id);
        // Change intent to CHAT to avoid merging
        aiResult.intent = isCancel ? 'CHAT' : aiResult.intent;
        if (isCancel) return await whatsappService.sendMessage(rawMessage.from, "ठीक है, मैंने कैंसिल कर दिया! और मैं आपकी क्या सहायता कर सकता हूँ? 😊");
      }

      // CONTEXTUAL MERGE: If intent is CHAT or matches pending intent and we have a pending incomplete action
      if ((aiResult.intent === 'CHAT' || aiResult.intent === pendingAction.intent) && isPendingValid && !isGreeting && !isCancel) {
         logger.info('🧠 Contextual Merge Check:', { pendingIntent: pendingAction.intent });
         
         if (pendingAction.intent === 'CREATE_REMINDER') {
            const mergedEntities = { ...pendingAction.entities };
            
            // Merge logic: fill in the blanks
            if (!mergedEntities.activity || mergedEntities.activity === 'none' || mergedEntities.activity === 'reminder' || mergedEntities.activity === 'null') {
               mergedEntities.activity = (aiResult.activity && aiResult.activity !== 'none' && aiResult.activity !== 'reminder' && aiResult.activity !== 'null') ? aiResult.activity : processedMessage.text;
            } 
            if (!mergedEntities.datetime || mergedEntities.datetime === 'none' || pendingAction.isPastTimeCorrection || mergedEntities.datetime === 'null') {
               // If it was a past time correction and they said "tomorrow", fix the date
               if (pendingAction.isPastTimeCorrection && processedMessage.text.toLowerCase().includes('tomorrow')) {
                  const oldDate = mergedEntities.datetime; // e.g. "2026-03-28T15:00:00+05:30"
                  const dateObj = new Date(oldDate.replace('+05:30', 'Z')); // Temporary Z for math
                  dateObj.setUTCDate(dateObj.getUTCDate() + 1);
                  const newDate = dateObj.toISOString().replace('.000Z', '+05:30');
                  mergedEntities.datetime = newDate;
               } else {
                  mergedEntities.datetime = (aiResult.time && aiResult.time !== 'none' && aiResult.time !== 'null') ? aiResult.time : processedMessage.text;
               }
            }
            
            aiResult.intent = 'CREATE_REMINDER';
            aiResult.entities = mergedEntities;
            aiResult.activity = mergedEntities.activity;
            aiResult.time = mergedEntities.datetime;
            aiResult.confidence = 0.99;
            logger.info('✅ Contextual Merge Success (Reminder):', { merged: mergedEntities });
         } else if (pendingAction.intent === 'CREATE_ROUTINE') {
            const mergedEntities = { ...pendingAction.entities };
            if (!mergedEntities.activity || mergedEntities.activity === 'none' || mergedEntities.activity === 'routine' || mergedEntities.activity === 'null') {
               mergedEntities.activity = (aiResult.activity && aiResult.activity !== 'none' && aiResult.activity !== 'routine' && aiResult.activity !== 'null') ? aiResult.activity : processedMessage.text;
            }
            if (!mergedEntities.time || mergedEntities.time === 'none' || mergedEntities.time === 'null') {
               mergedEntities.time = (aiResult.time && aiResult.time !== 'none' && aiResult.time !== 'null') ? aiResult.time : processedMessage.text;
            }
            
            aiResult.intent = 'CREATE_ROUTINE';
            aiResult.entities = mergedEntities;
            aiResult.activity = mergedEntities.activity;
            aiResult.time = mergedEntities.time;
            aiResult.confidence = 0.99;
            logger.info('✅ Contextual Merge Success (Routine):', { merged: mergedEntities });
         }
      }
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
            
            const activityMissing = !activity || activity.toLowerCase() === 'reminder' || activity.toLowerCase() === 'unknown' || activity.toLowerCase() === 'none' || activity.toLowerCase() === 'daily reminder';
            const timeMissing = !datetime || datetime.toLowerCase() === 'now' || datetime.toLowerCase() === 'unknown' || datetime.toLowerCase() === 'none' || datetime.toLowerCase() === 'daily' || datetime.toLowerCase() === 'everyday' || datetime.toLowerCase() === 'weekly' || datetime.toLowerCase() === 'monthly';
            
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
              
              // NEW: Set pending action to enable multi-turn continuation
              await ContextEngine.setPendingAction(user._id, {
                intent: 'CREATE_REMINDER',
                entities: { activity, datetime }
              });

              await whatsappService.sendMessage(rawMessage.from, clarificationMsg);
              return { success: false, incomplete: true, error: 'Missing activity or time' };
            }
            
            // Clear pending action if we are completing it
            await ContextEngine.clearPendingAction(user._id);
            
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
              
              // NEW: Past-time validation
              if (reminderDateTime) {
                const now = getCurrentTimeInKolkata();
                // Compare ISO strings (works because both are in same offset +05:30)
                if (reminderDateTime < now) {
                  const rawText = processedMessage.text.toLowerCase();
                  const hasExplicitDate = rawText.includes('tomorrow') || rawText.includes('कल') || rawText.includes('next') || rawText.match(/\d{4}-\d{2}-\d{2}/);
                  
                  if (!hasExplicitDate) {
                    logger.warn('⚠️ Past time detected for today - asking for date clarification');
                    const lang = aiEngine.detectLanguage(processedMessage.text);
                    let pastTimeMsg = '';
                    
                    if (lang === 'hindi' || lang === 'hinglish') {
                      pastTimeMsg = '🤔 Yeh samay toh nikal gaya hai! Kya aap ise "kal" ke liye set karna chahte hain? Ya koi aur date?';
                    } else {
                      pastTimeMsg = '🤔 That time has already passed for today. Do you want to set this for "tomorrow" or a different date?';
                    }
                    
                    await ContextEngine.setPendingAction(user._id, {
                      intent: 'CREATE_REMINDER',
                      entities: { activity, datetime: reminderDateTime },
                      isPastTimeCorrection: true
                    });
                    
                    await whatsappService.sendMessage(rawMessage.from, pastTimeMsg);
                    return { success: false, incomplete: true, error: 'Past time' };
                  }
                }
              }
              
              logger.info('⏰ Time parsing result:', {
                input: entities.datetime || entities.time,
                parsed: reminderDateTime,
                isValid: !!reminderDateTime && typeof reminderDateTime === 'string'
              });
            }
            
            // If parsing failed, actively ask user to clarify
            if (!reminderDateTime || typeof reminderDateTime !== 'string') {
              logger.error('❌ Time parsing failed - asking user to clarify:', {
                entities,
                reason: 'Could not extract valid time'
              });
              
              const lang = aiEngine.detectLanguage(processedMessage.text);
              let errMsg = '';
              if (lang === 'hindi') errMsg = '💭 माफ़ करना, मुझे समय समझ नहीं आया। क्या आप एक सटीक समय बता सकते हैं? (जैसे: शाम 4 बजे)';
              else if (lang === 'hinglish') errMsg = '💭 Sorry, mujhe time samajh nahi aaya. Kya aap exact time bata sakte hain? (jaise: 4:00 PM)';
              else errMsg = '💭 Sorry, I couldn\'t understand that time. Could you provide a specific time (like 4:00 PM)?';
              
              await whatsappService.sendMessage(rawMessage.from, errMsg);
              return { success: false, incomplete: true, error: 'Could not parse time string' };
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
            const activity = entities.activity?.toLowerCase() || '';
            if (activity && activity !== 'reminder' && activity !== 'null') {
              const reminders = await ReminderService.getActiveReminders(user._id);
              const match = reminders.find(r => r.title.toLowerCase().includes(activity));
              if (match) {
                const updateData = {};
                if (entities.datetime && entities.datetime !== 'null') updateData.datetime = parseTimeToDateTime(entities.datetime) || entities.datetime;
                if (entities.time && entities.time !== 'null') updateData.datetime = parseTimeToDateTime(entities.time) || entities.time;
                
                if (Object.keys(updateData).length === 0) {
                  return { success: false, incomplete: true, error: 'nothing_to_update' };
                }
                const reminder = await ReminderService.updateReminder(match._id, updateData);
                return { success: true, updated: match.title, data: reminder };
              }
            }
            return { success: false, error: 'Could not find a matching reminder to update.' };
          } catch (error) {
            logger.error('Failed to update reminder:', error.message);
            return { success: false };
          }
        },
        deleteReminder: async (entities) => {
          try {
            const rawText = processedMessage.text.toLowerCase();
            const activity = entities.activity?.toLowerCase() || '';
            
            // Check for 'all' in entity or raw text
            const isAll = activity.includes('all') || activity === 'everything' || activity === 'sab' || 
                         rawText.includes('all') || rawText.includes('everything') || rawText.includes('sab') || rawText.includes('saare');
            
            const isOneTimeOnly = rawText.includes('one-time') || rawText.includes('once') || rawText.includes('one time');
            const isRecurringOnly = rawText.includes('recurring') || rawText.includes('repeat') || rawText.includes('daily');

            if (isAll) {
              const reminders = await ReminderService.getActiveReminders(user._id);
              let deleteCount = 0;
              for (const r of reminders) {
                // Filter by category if specified
                if (isOneTimeOnly && r.repeat !== 'none') continue;
                if (isRecurringOnly && r.repeat === 'none') continue;
                
                await ReminderService.deleteReminder(r._id);
                deleteCount++;
              }
              
              let deletedMsg = 'all reminders';
              if (isOneTimeOnly) deletedMsg = 'all one-time reminders';
              if (isRecurringOnly) deletedMsg = 'all recurring reminders';
              
              if (deleteCount === 0) return { success: false, error: 'No matching reminders found to delete.' };
              return { success: true, deleted: deletedMsg };
            }

            // Normal deletion (specific name or vague)
            const reminders = await ReminderService.getActiveReminders(user._id);
            let match = null;

            // 1. Precise name match
            if (activity && activity !== 'reminder' && activity !== 'null') {
              match = reminders.find(r => r.title.toLowerCase().includes(activity));
            }

            // 2. Vague fallback: find last 'reminded' activity if user just said 'delete reminder'
            if (!match && (activity === 'reminder' || activity === 'it' || !activity)) {
              const lastReminded = await ActivityLog.findOne({
                userId: user._id,
                status: 'reminded'
              }).sort({ date: -1 });

              if (lastReminded) {
                match = reminders.find(r => r.title.toLowerCase().includes(lastReminded.activity.toLowerCase()));
              }
            }

            if (match) {
              await ReminderService.deleteReminder(match._id);
              return { success: true, deleted: match.title };
            }

            return { success: false, error: 'Could not find a matching reminder to delete.' };
          } catch (error) {
            logger.error('Failed to delete reminder:', error.message);
            return { success: false };
          }
        }
      },

      activityService: {
        logActivity: async (entities) => {
          try {
            let targetActivity = entities.activity || 'Activity';
            
            // If activity is generic (like "Activity" or missing), try to find the last thing we reminded them about
            if (!entities.activity || entities.activity.toLowerCase() === 'activity' || entities.activity.toLowerCase() === 'task') {
              const lastReminded = await ActivityLog.findOne({
                userId: user._id,
                status: 'reminded'
              }).sort({ date: -1 });
              
              if (lastReminded) {
                targetActivity = lastReminded.activity;
                logger.info('Vague "done" matched to last reminder:', { matchedActivity: targetActivity });
              }
            }

            const activityLog = await ActivityService.logActivity(
              user._id,
              targetActivity,
              entities.status || 'done',
              {
                date: entities.date,
                duration: entities.duration,
                notes: entities.notes
              }
            );
            logger.info('Activity logged:', { activityId: activityLog._id, activity: targetActivity });
            return { success: true, data: activityLog };
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
            
            const activityMissing = !activity || activity.toLowerCase() === 'routine' || activity.toLowerCase() === 'unknown' || activity.toLowerCase() === 'null' || activity.toLowerCase() === 'none' || activity.toLowerCase() === 'daily routine';
            const timeMissing = !time || time.toLowerCase() === 'now' || time.toLowerCase() === 'unknown' || time.toLowerCase() === 'null' || time.toLowerCase() === 'none' || time.toLowerCase() === 'daily' || time.toLowerCase() === 'everyday' || time.toLowerCase() === 'weekly' || time.toLowerCase() === 'monthly';
            
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

              // NEW: Set pending action for routines
              await ContextEngine.setPendingAction(user._id, {
                intent: 'CREATE_ROUTINE',
                entities: { activity, time }
              });

              await whatsappService.sendMessage(rawMessage.from, clarificationMsg);
              return { success: false, incomplete: true, error: 'Missing activity or time for routine' };
            }
            
            // Parse time properly into HH:mm format required for routines
            let parsedTimeStr = null;
            if (time && time !== 'none' && time !== 'null' && time !== 'daily' && time !== 'unknown') {
              const parsedDateTime = parseTimeToDateTime(time);
              if (parsedDateTime) {
                // Return format is "2026-03-28T11:22:00+05:30"
                const match = parsedDateTime.match(/T(\d{2}):(\d{2}):/);
                if (match) {
                  parsedTimeStr = `${match[1]}:${match[2]}`;
                }
              }
            }
            
            if (!parsedTimeStr) {
              logger.error('❌ Time parsing failed for routine - asking user to clarify:', { time });
              const lang = aiEngine.detectLanguage(processedMessage.text);
              const errMsg = lang === 'hindi' ? '💭 माफ़ करना, मुझे समय समझ नहीं आया। क्या आप एक सटीक समय बता सकते हैं? (जैसे: शाम 4 बजे)' :
                             lang === 'hinglish' ? '💭 Sorry, mujhe time samajh nahi aaya. Kya aap exact time bata sakte hain? (jaise: 4:00 PM)' :
                             '💭 Sorry, I couldn\'t understand that time. Could you provide a specific time (like 4:00 PM)?';
              
              await ContextEngine.setPendingAction(user._id, {
                intent: 'CREATE_ROUTINE',
                entities: { activity, time: null }
              });
              await whatsappService.sendMessage(rawMessage.from, errMsg);
              return { success: false, incomplete: true, error: 'Could not parse time string' };
            }
            
            // Clear pending routine action
            await ContextEngine.clearPendingAction(user._id);

            const routine = await RoutineService.createRoutine(user._id, {
              activity: activity,
              schedule: entities.schedule || 'daily',
              time: parsedTimeStr,
              daysOfWeek: entities.daysOfWeek,
              description: entities.description
            });
            logger.info('Routine created:', { routineId: routine._id });
            await ContextEngine.clearPendingAction(user._id);
            return { success: true, data: routine };
          } catch (error) {
            logger.error('Failed to create routine:', error.message);
            return { success: false };
          }
        },
        updateRoutine: async (entities) => {
          try {
            const activity = entities.activity?.toLowerCase() || '';
            if (activity && activity !== 'routine' && activity !== 'null') {
              const routines = await RoutineService.getUserRoutines(user._id);
              const match = routines.find(r => r.activity.toLowerCase().includes(activity));
              if (match) {
                const updateData = {};
                if (entities.time && entities.time !== 'null') updateData.time = entities.time;
                if (entities.schedule) updateData.schedule = entities.schedule;
                
                if (Object.keys(updateData).length === 0) {
                  return { success: false, incomplete: true, error: 'nothing_to_update' };
                }
                const routine = await RoutineService.updateRoutine(match._id, updateData);
                await ContextEngine.clearPendingAction(user._id);
                return { success: true, updated: match.activity, data: routine };
              }
            }
            return { success: false, error: 'Could not find a matching routine to update.' };
          } catch (error) {
            logger.error('Failed to update routine:', error.message);
            return { success: false };
          }
        },
        deleteRoutine: async (entities) => {
          try {
            const rawText = processedMessage.text.toLowerCase();
            const activity = entities.activity?.toLowerCase() || '';
            
            const isAll = activity.includes('all') || activity === 'everything' || activity === 'sab' ||
                         rawText.includes('all') || rawText.includes('everything') || rawText.includes('sab') || rawText.includes('saare');
            
            if (isAll) {
              const routines = await RoutineService.getUserRoutines(user._id);
              for (const r of routines) {
                await RoutineService.deleteRoutine(r._id);
              }
              await ContextEngine.clearPendingAction(user._id);
              return { success: true, deleted: 'all routines' };
            }

            const routines = await RoutineService.getUserRoutines(user._id);
            let match = null;

            if (activity && activity !== 'routine' && activity !== 'null') {
              match = routines.find(r => r.activity.toLowerCase().includes(activity));
            }

            // Vague fallback: last reminded routine
            if (!match && (activity === 'routine' || !activity)) {
              const lastReminded = await ActivityLog.findOne({
                userId: user._id,
                status: 'reminded'
              }).sort({ date: -1 });

              if (lastReminded) {
                match = routines.find(r => r.activity.toLowerCase().includes(lastReminded.activity.toLowerCase()));
              }
            }

            if (match) {
              await RoutineService.deleteRoutine(match._id);
              await ContextEngine.clearPendingAction(user._id);
              return { success: true, deleted: match.activity };
            }

            return { success: false, error: 'Could not find a matching routine to delete.' };
          } catch (error) {
            logger.error('Failed to delete routine:', error.message);
            return { success: false };
          }
        },
        queryRoutine: async (entities) => {
          try {
            const routines = await RoutineService.getUserRoutines(user._id);
            await ContextEngine.clearPendingAction(user._id);
            return { success: true, data: routines };
          } catch (error) {
            logger.error('Failed to query routines:', error.message);
            return { success: false };
          }
        }
      },

      goalService: {
        createGoal: async (entities) => {
          try {
            const goalTitle = entities.activity || entities.goal || '';
            if (!goalTitle || goalTitle === 'goal' || goalTitle === 'null') {
              const lang = aiEngine.detectLanguage(processedMessage.text);
              let msg = '🤔 What goal do you want to achieve? Tell me more!';
              if (lang === 'hindi' || lang === 'hinglish') msg = '🤔 Aap kaisa goal achieve karna chahte hain? Mujhe batao!';
              await whatsappService.sendMessage(rawMessage.from, msg);
              return { success: false, incomplete: true };
            }

            const deadline = entities.time || entities.deadline || null;

            // 1. Create goal
            const goal = await GoalService.createGoal(user._id, {
              title: goalTitle,
              deadline
            });

            // 2. AI breakdown
            const breakdown = await aiEngine.generateGoalBreakdown(goalTitle, deadline);

            // 3. Set sub-tasks on goal
            await GoalService.setSubTasks(goal._id, breakdown.subTasks);

            // 4. Convert sub-tasks to actual reminders/routines
            const result = await GoalService.convertSubTasksToActions(user._id, goal._id);
            
            // 5. Clear pending action
            await ContextEngine.clearPendingAction(user._id);

            // 6. Build summary for user
            let taskList = breakdown.subTasks.map((t, i) => 
              `${i + 1}. ${t.type === 'routine' ? '🔄' : '⏰'} ${t.title} @ ${t.time}`
            ).join('\n');

            return { 
              success: true, 
              data: { 
                goal: result.goal,
                taskList,
                routinesCreated: result.routines,
                remindersCreated: result.reminders 
              } 
            };
          } catch (error) {
            logger.error('Failed to create goal:', error.message);
            return { success: false, error: error.message };
          }
        },
        queryGoals: async (entities) => {
          try {
            const goals = await GoalService.getUserGoals(user._id);
            if (goals.length === 0) {
              return { success: true, data: { formatted: '', count: 0 } };
            }

            let formatted = '';
            let targetGoal = null;
            
            const activity = entities?.activity?.toLowerCase() || '';
            const isGeneric = ['goal', 'goals', 'subtask', 'subtasks', 'task', 'tasks', 'my goals', 'progress', 'list', 'null', 'none', 'unknown'].includes(activity);
            
            if (activity && !isGeneric) {
              const searchTerms = activity.replace(/\b(goal|my|the|a|an)\b/gi, '').trim().split(/\s+/).filter(w => w.length > 2);
              targetGoal = goals.find(g => {
                const titleLower = g.title.toLowerCase();
                if (activity.includes(titleLower) || titleLower.includes(activity)) return true;
                if (searchTerms.length > 0 && searchTerms.some(term => titleLower.includes(term))) return true;
                return false;
              });
            }
            
            if (targetGoal) {
              formatted = `📌 **${targetGoal.title}** (Sub-tasks)\n`;
              if (targetGoal.subTasks.length === 0) {
                 formatted += `\nNo tasks found.`;
              } else {
                 targetGoal.subTasks.forEach((t, i) => {
                   const icon = t.status === 'completed' ? '✅' : (t.type === 'routine' ? '🔄' : '⏰');
                   formatted += `\n${i + 1}. ${icon} ${t.title} @ ${t.time || 'flexible'}`;
                 });
              }
              const progressBar = '█'.repeat(Math.floor(targetGoal.progress / 10)) + '░'.repeat(10 - Math.floor(targetGoal.progress / 10));
              formatted += `\n\nProgress: ${progressBar} ${targetGoal.progress}%`;
            } else {
              formatted = `🎯 Your Goals (${goals.length})\n`;
              for (const goal of goals) {
                const progressBar = '█'.repeat(Math.floor(goal.progress / 10)) + '░'.repeat(10 - Math.floor(goal.progress / 10));
                formatted += `\n📌 **${goal.title}**\n   ${progressBar} ${goal.progress}%`;
                if (goal.subTasks.length > 0) {
                  const done = goal.subTasks.filter(t => t.status === 'completed').length;
                  formatted += ` (${done}/${goal.subTasks.length} tasks)`;
                }
              }
            }

            await ContextEngine.clearPendingAction(user._id);
            return { success: true, data: { formatted, count: targetGoal ? 1 : goals.length } };
          } catch (error) {
            logger.error('Failed to query goals:', error.message);
            return { success: false };
          }
        },
        updateGoal: async (entities) => {
          try {
            const activity = entities.activity?.toLowerCase() || '';
            const goals = await GoalService.getUserGoals(user._id);
            let match = null;
            if (activity && activity !== 'goal' && activity !== 'null') {
              const searchTerms = activity.replace(/\b(goal|my|the|a|an)\b/gi, '').trim().split(/\s+/).filter(w => w.length > 2);
              match = goals.find(g => {
                const titleLower = g.title.toLowerCase();
                if (activity.includes(titleLower) || titleLower.includes(activity)) return true;
                if (searchTerms.length > 0 && searchTerms.some(term => titleLower.includes(term))) return true;
                return false;
              });
            }

            if (match) {
              const updateData = {};
              if (entities.time && entities.time !== 'null') updateData.deadline = entities.time;
              if (entities.datetime && entities.datetime !== 'null') updateData.deadline = entities.datetime;
              
              if (Object.keys(updateData).length === 0) {
                 return { success: false, incomplete: true, error: 'nothing_to_update' };
              }
              const goal = await GoalService.updateGoal(match._id, updateData);
              await ContextEngine.clearPendingAction(user._id);
              return { success: true, updated: match.title, data: goal };
            }
            return { success: false, error: 'Could not find a matching goal to update.' };
          } catch (error) {
            logger.error('Failed to update goal:', error.message);
            return { success: false };
          }
        },
        deleteGoal: async (entities) => {
          try {
            const rawText = processedMessage.text.toLowerCase();
            const activity = entities.activity?.toLowerCase() || '';
            const isAll = activity.includes('all') || activity === 'everything' || activity === 'sab' ||
                         rawText.includes('all') || rawText.includes('everything') || rawText.includes('sab') || rawText.includes('saare');
            
            const goals = await GoalService.getUserGoals(user._id);
            if (isAll) {
              for (const g of goals) {
                await GoalService.deleteGoal(g._id);
              }
              await ContextEngine.clearPendingAction(user._id);
              return { success: true, deleted: 'all goals' };
            }

            let match = null;
            if (activity && activity !== 'goal' && activity !== 'null') {
              const searchTerms = activity.replace(/\b(goal|my|the|a|an)\b/gi, '').trim().split(/\s+/).filter(w => w.length > 2);
              match = goals.find(g => {
                const titleLower = g.title.toLowerCase();
                if (activity.includes(titleLower) || titleLower.includes(activity)) return true;
                if (searchTerms.length > 0 && searchTerms.some(term => titleLower.includes(term))) return true;
                return false;
              });
            }

            if (match) {
              await GoalService.deleteGoal(match._id);
              await ContextEngine.clearPendingAction(user._id);
              return { success: true, deleted: match.title };
            }

            return { success: false, error: 'Could not find a matching goal to delete.' };
          } catch (error) {
            logger.error('Failed to delete goal:', error.message);
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
        },
        contactService: {
          makeCall: async (entities) => {
            try {
              const person = entities.activity || '';
              if (!person || person === 'null') {
                await whatsappService.sendMessage(rawMessage.from, "🤔 Who do you want to call? Please tell me their name.");
                return { success: false, incomplete: true };
              }

              const contact = await ContactService.findContact(user._id, person);
              if (contact) {
                const lang = aiEngine.detectLanguage(processedMessage.text);
                let msg = `📞 Calling **${contact.name}**...\n\n👉 Tap here to call: tel:${contact.phone}`;
                if (lang === 'hindi' || lang === 'hinglish') {
                  msg = `📞 **${contact.name}** ko call kar raha hoon...\n\n👉 Call karne ke liye yahan tap karein: tel:${contact.phone}`;
                }
                
                await whatsappService.sendMessage(rawMessage.from, msg);
                return { success: true, callStarted: true, contact: contact.name };
              } else {
                const lang = aiEngine.detectLanguage(processedMessage.text);
                let msg = `🤔 I couldn't find a contact named "${person}".\n\nTo save it, say: "save ${person}'s number [phone_number]"`;
                if (lang === 'hindi' || lang === 'hinglish') {
                  msg = `🤔 Mujhe "${person}" ke naam se koi contact nahi mila.\n\nSave karne ke liye kahein: "${person} ka number save karo [phone_number]"`;
                }
                await whatsappService.sendMessage(rawMessage.from, msg);
                return { success: false, error: 'contact_not_found' };
              }
            } catch (error) {
              logger.error('Failed to make call:', error.message);
              return { success: false, error: error.message };
            }
          },
          saveContact: async (entities) => {
            try {
              const name = entities.activity || '';
              const phone = entities.time || ''; // AI often puts the digits here

              // If AI missed extracting, try a simple regex on the original text
              let detectedPhone = phone;
              if (!detectedPhone || !/\d{5,}/.test(detectedPhone)) {
                const match = processedMessage.text.match(/(\d{5,15})/);
                if (match) detectedPhone = match[1];
              }

              if (!name || name === 'null' || !detectedPhone) {
                await whatsappService.sendMessage(rawMessage.from, "🤔 Please provide both name and phone number to save a contact. (e.g. 'save Rahul 9876543210')");
                return { success: false, incomplete: true };
              }

              // Determine relationship and aliases if possible
              let relationship = 'other';
              const aliases = [];
              const lowerText = processedMessage.text.toLowerCase();
              if (lowerText.includes('bhai') || lowerText.includes('brother')) {
                relationship = 'family';
                aliases.push('bhai');
              } else if (lowerText.includes('mom') || lowerText.includes('mummy')) {
                relationship = 'family';
                aliases.push('mom', 'mummy');
              } else if (lowerText.includes('papa') || lowerText.includes('dad')) {
                relationship = 'family';
                aliases.push('papa', 'dad');
              }

              const result = await ContactService.saveContact(user._id, name, detectedPhone, relationship, aliases);
              
              const lang = aiEngine.detectLanguage(processedMessage.text);
              let msg = `✅ Contact saved: **${name}** (${detectedPhone})`;
              if (lang === 'hindi' || lang === 'hinglish') {
                msg = `✅ Contact save ho gaya: **${name}** (${detectedPhone})`;
              }
              
              await whatsappService.sendMessage(rawMessage.from, msg);
              return { success: true, data: result.contact };
            } catch (error) {
              logger.error('Failed to save contact:', error.message);
              return { success: false, error: error.message };
            }
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

      // NEW: Stop if these specific intents were handled successfully
      const handledIntents = ['MAKE_CALL', 'SAVE_CONTACT'];
      if (routeResult && routeResult.success && handledIntents.includes(aiResult.intent)) {
        logger.info(`✅ Intent ${aiResult.intent} handled successfully. Stopping generic response flow.`);
        return res.status(200).json({ status: 'ok', handled: aiResult.intent });
      }
    } catch (error) {
      logger.warn('Route handling failed:', error.message);
    }

    // Generate response using AI (Groq)
    let responseText;
    try {
      // Include user profile in context for personalization
      const memoryContext = await MemoryService.buildMemoryContext(user._id);
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
        },
        memoryContext
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
