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
    if (!user) {
      user = new User({
        phone: rawMessage.from,
        name: rawMessage.senderName || 'User',
        onboardingCompleted: false,
        onboardingStep: 0,
        preferredLanguage: userLanguage  // Set language from first message
      });
      await user.save();
      isNewUser = true;
      logger.info('🆕 New user created:', { userId: user._id, phone: rawMessage.from, language: userLanguage });
    } else {
      logger.debug('👤 Existing user found:', {
        userId: user._id,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        userType: user.userType
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
        const firstQuestion = OnboardingService.getFirstQuestion(user.preferredLanguage);
        
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
        
        logger.info('Sent welcome + first onboarding question combined:', { userId: user._id, language: user.preferredLanguage });
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

    // Detect intent using AI (Groq)
    let aiResult;
    try {
      aiResult = await aiEngine.detectIntent(processedMessage.text, {
        lastActivity: context.context.lastActivity,
        missedActivities: context.context.missedActivities
      });
    } catch (error) {
      logger.warn('AI detection failed, defaulting to CHAT:', error.message);
      aiResult = {
        intent: 'CHAT',
        confidence: 0.5,
        entities: {},
        activity: null
      };
    }

    // Setup service handlers
    const handlers = {
      reminderService: {
        createReminder: async (entities) => {
          try {
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
              
              // Use today's current time + 5 minutes as fallback
              const fallbackTime = new Date();
              fallbackTime.setMinutes(fallbackTime.getMinutes() + 5);
              const year = fallbackTime.getFullYear();
              const month = String(fallbackTime.getMonth() + 1).padStart(2, '0');
              const day = String(fallbackTime.getDate()).padStart(2, '0');
              const hours = String(fallbackTime.getHours()).padStart(2, '0');
              const mins = String(fallbackTime.getMinutes()).padStart(2, '0');
              reminderDateTime = `${year}-${month}-${day}T${hours}:${mins}:00+05:30`;
              
              logger.warn('⚠️ Using fallback reminder time (5 mins from now):', {
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
            const routine = await RoutineService.createRoutine(user._id, {
              activity: entities.activity || 'Activity',
              schedule: entities.schedule || 'daily',
              time: entities.time || '06:00',
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
