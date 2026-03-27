import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog.js';
import logger from '../utils/logger.js';

/**
 * Activity Service
 * Handles activity logging and tracking
 */
export class ActivityService {
  /**
   * Log activity completion/skip
   */
  static async logActivity(userId, activity, status, data = {}) {
    try {
      const log = new ActivityLog({
        userId,
        activity,
        status,
        date: data.date || new Date(),
        duration: data.duration,
        notes: data.notes
      });

      await log.save();
      logger.info('Activity logged:', { userId, activity, status });
      return log;
    } catch (error) {
      logger.error('Failed to log activity:', error.message);
      throw error;
    }
  }

  /**
   * Get activity history
   */
  static async getActivityHistory(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await ActivityLog.find({
        userId,
        date: { $gte: startDate }
      }).sort({ date: -1 });
    } catch (error) {
      logger.error('Failed to get activity history:', error.message);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  static async getActivityStats(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await ActivityLog.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$activity',
            done: {
              $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] }
            },
            skipped: {
              $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] }
            },
            missed: {
              $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
            }
          }
        }
      ]);

      return logs;
    } catch (error) {
      logger.error('Failed to get activity stats:', error.message);
      throw error;
    }
  }
}

export default ActivityService;
