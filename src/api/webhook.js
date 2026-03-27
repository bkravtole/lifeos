import express from 'express';
import { verifyWebhookSignature } from '../middleware/index.js';
import MessageProcessor from '../services/MessageProcessor.js';
import AIEngine from '../services/AIEngine.js';
import IntentRouter from '../services/IntentRouter.js';
import WhatsAppService from '../services/WhatsAppService.js';
import ContextEngine from '../services/ContextEngine.js';
import ReminderService from '../services/ReminderService.js';
import RoutineService from '../services/RoutineService.js';
import ActivityService from '../services/ActivityService.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();
let aiEngine, whatsappService;

// Initialize services
try {
  aiEngine = new AIEngine();
  whatsappService = new WhatsAppService();
} catch (error) {
  logger.error('Failed to initialize services:', error.message);
}

/**
 * POST /webhook/whatsapp
 * Receive and process incoming WhatsApp messages
 */
router.post('/whatsapp', verifyWebhookSignature, async (req, res) => {
  try {
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

    // Ensure user exists in DB
    let user = await User.findOne({ phone: rawMessage.from });
    if (!user) {
      user = new User({
        phone: rawMessage.from,
        name: rawMessage.senderName || 'User'
      });
      await user.save();
      logger.info('New user created:', { userId: user._id, phone: rawMessage.from });
    }

    // Update user metadata
    user.metadata.lastMessageAt = new Date();
    user.metadata.totalMessages = (user.metadata.totalMessages || 0) + 1;
    await user.save();

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
            const reminder = await ReminderService.createReminder(user._id, {
              activity: entities.activity || 'Event',
              title: entities.activity || 'Event',
              datetime: entities.datetime || new Date(),
              repeat: entities.repeat || 'none',
              priority: entities.priority || 'medium',
              description: entities.description
            });
            logger.info('Reminder created:', { reminderId: reminder._id });
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
      routeResult = await IntentRouter.route(aiResult.intent, aiResult.entities || {}, handlers);
    } catch (error) {
      logger.warn('Route handling failed:', error.message);
    }

    // Generate response using AI (Groq)
    let responseText;
    try {
      responseText = await aiEngine.generateResponse(
        aiResult.intent,
        aiResult.entities || {},
        context.context
      );
    } catch (error) {
      logger.warn('Response generation failed, using fallback:', error.message);
      responseText = 'समझ नहीं आया 😅 फिर से बताओ';
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

export default router;
