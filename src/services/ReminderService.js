import Reminder from '../models/Reminder.js';
import logger from '../utils/logger.js';

/**
 * Reminder Service
 * Handles reminder creation, updates, and queries
 */
export class ReminderService {
  /**
   * Create new reminder
   */
  static async createReminder(userId, data) {
    try {
      const reminder = new Reminder({
        userId,
        title: data.activity || data.title,
        description: data.description,
        datetime: data.datetime || new Date(),
        repeat: data.repeat || 'none',
        priority: data.priority || 'medium'
      });

      await reminder.save();
      logger.info('Reminder created:', { reminderId: reminder._id, userId });
      return reminder;
    } catch (error) {
      logger.error('Failed to create reminder:', error.message);
      throw error;
    }
  }

  /**
   * Get active reminders for user
   */
  static async getActiveReminders(userId) {
    try {
      return await Reminder.find({
        userId,
        status: 'active'
      });
    } catch (error) {
      logger.error('Failed to get active reminders:', error.message);
      throw error;
    }
  }

  /**
   * Update reminder
   */
  static async updateReminder(reminderId, data) {
    try {
      const reminder = await Reminder.findByIdAndUpdate(
        reminderId,
        data,
        { new: true }
      );

      logger.info('Reminder updated:', { reminderId });
      return reminder;
    } catch (error) {
      logger.error('Failed to update reminder:', error.message);
      throw error;
    }
  }

  /**
   * Mark reminder as notified
   */
  static async markNotified(reminderId) {
    try {
      return await Reminder.findByIdAndUpdate(
        reminderId,
        {
          notified: true,
          notifiedAt: new Date()
        },
        { new: true }
      );
    } catch (error) {
      logger.error('Failed to mark reminder as notified:', error.message);
      throw error;
    }
  }

  /**
   * Delete reminder
   */
  static async deleteReminder(reminderId) {
    try {
      await Reminder.findByIdAndDelete(reminderId);
      logger.info('Reminder deleted:', { reminderId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete reminder:', error.message);
      throw error;
    }
  }

  /**
   * Get reminders due now (for scheduler)
   * Returns reminders that haven't been notified yet and are due
   */
  static async getRemindersdue() {
    try {
      // Get reminders that are active, not yet notified, and have a datetime set
      // We'll get reminders that might be due soon (within last 24 hours to handle different timezones/delays)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      return await Reminder.find({
        status: 'active',
        notified: false,
        datetime: { 
          $gte: oneDayAgo  // Get reminders set within last 24 hours
        }
      }).populate('userId');
    } catch (error) {
      logger.error('Failed to get reminders due:', error.message);
      return [];
    }
  }
}

export default ReminderService;
