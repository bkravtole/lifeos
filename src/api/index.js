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
