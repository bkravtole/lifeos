import logger from '../utils/logger.js';
import ActivityLog from '../models/ActivityLog.js';
import Reminder from '../models/Reminder.js';
import WhatsAppService from './WhatsAppService.js';

/**
 * Proactive Engine
 * Initiates interactions based on user behavior and triggers
 */
export class ProactiveEngine {
  constructor() {
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Check for missed activities (proactive)
   */
  async checkMissedActivities() {
    try {
      logger.info('Checking for missed activities...');

      // Get activities from last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const missedActivities = await ActivityLog.aggregate([
        {
          $match: {
            status: 'missed',
            createdAt: { $gte: yesterday }
          }
        },
        {
          $group: {
            _id: '$userId',
            activities: { $push: '$activity' },
            count: { $sum: 1 }
          }
        }
      ]);

      for (const record of missedActivities) {
        await this._proactiveReminder(record._id, record.activities, record.count);
      }
    } catch (error) {
      logger.error('Failed to check missed activities:', error.message);
    }
  }

  /**
   * Check for inactivity (proactive)
   */
  async checkInactivity() {
    try {
      logger.info('Checking for user inactivity...');

      // Get users with no activity in last 2 days
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const inactiveUsers = await ActivityLog.distinct('userId', {
        createdAt: { $lte: twoDaysAgo }
      });

      for (const userId of inactiveUsers) {
        await this._inactivityMessage(userId);
      }
    } catch (error) {
      logger.error('Failed to check inactivity:', error.message);
    }
  }

  /**
   * Check sleep time and reduce notifications
   */
  async checkSleepTime(user) {
    try {
      const hour = new Date().getHours();
      const sleepStart = 22; // 10 PM
      const sleepEnd = 6; // 6 AM

      if (hour >= sleepStart || hour < sleepEnd) {
        logger.info('User is likely sleeping:', { userId: user._id });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check sleep time:', error.message);
      return false;
    }
  }

  /**
   * Send proactive missed activity reminder
   */
  async _proactiveReminder(userId, activities, count) {
    try {
      const user = await this.getUserData(userId);
      const isSleeping = await this.checkSleepTime(user);

      if (isSleeping) {
        logger.info('Skipping notification - user is sleeping', { userId });
        return;
      }

      const activityList = activities.join(', ');
      const message = `📊 आपने कल ${count} काम नहीं किए: ${activityList}\n\nआज फिर से शुरु करते हैं? 💪`;

      await this.whatsappService.sendMessage(user.phone, message);

      logger.info('Proactive reminder sent:', { userId, activities });
    } catch (error) {
      logger.error('Failed to send proactive reminder:', error.message);
    }
  }

  /**
   * Send inactivity engagement message
   */
  async _inactivityMessage(userId) {
    try {
      const user = await this.getUserData(userId);
      const isSleeping = await this.checkSleepTime(user);

      if (isSleeping) {
        logger.info('Skipping notification - user is sleeping', { userId });
        return;
      }

      const message = `👋 हम आपसे मिस कर रहे हैं! 😊\n\nएक कुछ बताइए आप कैसे हैं? या अपने अगले काम को शेड्यूल करें।`;

      await this.whatsappService.sendMessage(user.phone, message);

      logger.info('Inactivity engagement message sent:', { userId });
    } catch (error) {
      logger.error('Failed to send inactivity message:', error.message);
    }
  }

  /**
   * Get user data (placeholder)
   */
  async getUserData(userId) {
    // TODO: Import and use User model
    return { _id: userId, phone: '' };
  }
}

export default ProactiveEngine;
