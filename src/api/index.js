import express from 'express';
import User from '../models/User.js';
import ReminderService from '../services/ReminderService.js';
import RoutineService from '../services/RoutineService.js';
import ActivityService from '../services/ActivityService.js';
import ContextEngine from '../services/ContextEngine.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/user/:phoneNumber
 * Get user profile
 */
router.get('/user/:phoneNumber', async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phoneNumber });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Failed to get user:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reminders/:userId
 * Get active reminders
 */
router.get('/reminders/:userId', async (req, res) => {
  try {
    const reminders = await ReminderService.getActiveReminders(req.params.userId);
    res.json(reminders);
  } catch (error) {
    logger.error('Failed to get reminders:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/routines/:userId
 * Get user routines
 */
router.get('/routines/:userId', async (req, res) => {
  try {
    const routines = await RoutineService.getUserRoutines(req.params.userId);
    res.json(routines);
  } catch (error) {
    logger.error('Failed to get routines:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/activity-history/:userId
 * Get activity history
 */
router.get('/activity-history/:userId', async (req, res) => {
  try {
    const days = req.query.days || 30;
    const history = await ActivityService.getActivityHistory(req.params.userId, days);
    res.json(history);
  } catch (error) {
    logger.error('Failed to get activity history:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/context/:userId
 * Get user context
 */
router.get('/context/:userId', async (req, res) => {
  try {
    const context = await ContextEngine.getContext(req.params.userId);
    res.json(context);
  } catch (error) {
    logger.error('Failed to get context:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/test/reminder
 * Create a test reminder for 1 minute from now
 * Useful for debugging reminder system
 */
router.post('/test/reminder', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Find user
    const user = await User.findOne({ phone: phoneNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create reminder for 1 minute from now
    const now = new Date();
    const reminderTime = new Date(now.getTime() + 60000); // 1 minute later

    const reminder = await ReminderService.createReminder(user._id, {
      title: `🧪 TEST REMINDER at ${reminderTime.toLocaleTimeString('en-IN')}`,
      description: 'This is a test reminder. If you receive this, the reminder system is working!',
      datetime: reminderTime,
      repeat: 'none',
      priority: 'high'
    });

    logger.info('✅ Test reminder created:', {
      reminderId: reminder._id,
      userId: user._id,
      phoneNumber,
      reminderTime: reminderTime.toISOString(),
      createdAt: now.toISOString()
    });

    res.json({
      success: true,
      message: 'Test reminder created',
      reminder: {
        id: reminder._id,
        title: reminder.title,
        scheduledTime: reminderTime.toISOString(),
        message: `Check your WhatsApp at ${reminderTime.toLocaleTimeString('en-IN')} for the test reminder`,
        createdAt: now.toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to create test reminder:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/debug/reminders
 * View all pending reminders (debugging endpoint)
 */
router.get('/debug/reminders', async (req, res) => {
  try {
    const reminders = await ReminderService.getReminders();
    
    const formattedReminders = reminders.map(r => ({
      id: r._id,
      title: r.title,
      scheduledTime: r.datetime,
      status: r.status,
      notified: r.notified,
      userId: r.userId?._id,
      phone: r.userId?.phone,
      repeat: r.repeat,
      createdAt: r.createdAt,
      minutesUntilDue: ((new Date(r.datetime) - new Date()) / 60000).toFixed(1)
    }));

    res.json({
      count: formattedReminders.length,
      now: new Date().toISOString(),
      reminders: formattedReminders
    });
  } catch (error) {
    logger.error('Failed to get reminders:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/debug/time-parse
 * Test time parsing function
 */
router.get('/api/debug/time-parse', (req, res) => {
  const { timeStr } = req.query;
  
  if (!timeStr) {
    return res.status(400).json({
      error: 'timeStr parameter required',
      examples: [
        '/api/debug/time-parse?timeStr=00:15%20AM%20today',
        '/api/debug/time-parse?timeStr=2:30%20PM%20today',
        '/api/debug/time-parse?timeStr=tomorrow%209%20AM'
      ]
    });
  }

  // Copy of parseTimeToDateTime from webhook
  function parseTimeToDateTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
      return null;
    }

    try {
      const now = new Date();
      let targetDate = new Date(now);
      let hour = null;
      let minute = 0;
      
      const lowerStr = timeStr.toLowerCase().trim();

      const timeMatch = lowerStr.match(/(\d{1,2})\s*[:./]?\s*(\d{2})?\s*(am|pm|a\.m|p\.m)?/i);
      
      if (timeMatch) {
        hour = parseInt(timeMatch[1]);
        minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

        if (timeMatch[3]) {
          const ampm = timeMatch[3].toLowerCase().replace('.', '');
          if (ampm === 'pm' && hour < 12) {
            hour += 12;
          }
          if (ampm === 'am' && hour === 12) {
            hour = 0;
          }
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          return null;
        }
      }

      if (hour === null) {
        hour = 9;
        minute = 0;
      }

      if (lowerStr.includes('tomorrow') || lowerStr.includes('कल') || lowerStr.includes('agle din')) {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (lowerStr.includes('today') || lowerStr.includes('आज') || lowerStr.includes('aaj')) {
        targetDate = new Date(now);
        const proposedTime = new Date(now);
        proposedTime.setHours(hour, minute, 0, 0);
        
        if (proposedTime <= now) {
          targetDate.setDate(targetDate.getDate() + 1);
        } else {
          targetDate = new Date(now);
        }
      } else {
        const proposedTime = new Date(now);
        proposedTime.setHours(hour, minute, 0, 0);
        
        if (proposedTime > now) {
          targetDate = new Date(now);
        } else {
          targetDate.setDate(targetDate.getDate() + 1);
        }
      }

      targetDate.setHours(hour, minute, 0, 0);
      return targetDate;
    } catch (error) {
      return null;
    }
  }

  const result = parseTimeToDateTime(timeStr);

  res.json({
    input: timeStr,
    currentTime: new Date().toISOString(),
    parsedTime: result ? result.toISOString() : null,
    parsedTimeLocal: result ? result.toLocaleString('en-IN') : null,
    minutesFromNow: result ? ((result - new Date()) / 60000).toFixed(1) : null
  });
});

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

export default router;
