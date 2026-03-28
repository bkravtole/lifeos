import cron from 'node-cron';
import ReminderService from './ReminderService.js';
import RoutineService from './RoutineService.js';
import WhatsAppService from './WhatsAppService.js';
import logger from '../utils/logger.js';
import { isReminderDue, formatTimeInKolkata, getTimeRemaining } from '../utils/timezone.js';

/**
 * Reminder Scheduler
 * Runs proactive reminder checks every minute
 * Works on local AND can be triggered on Vercel via external cron service
 */
export class ReminderScheduler {
  constructor() {
    this.job = null;
    this.whatsappService = new WhatsAppService();
    this.isRunning = false;
  }

  /**
   * Start the reminder scheduler
   * Checks for due reminders every minute
   */
  start() {
    if (this.isRunning) {
      logger.warn('⚠️ Reminder scheduler already running');
      return;
    }

    try {
      // Run every minute: "* * * * *" means every minute
      this.job = cron.schedule('* * * * *', () => {
        this.checkAndSendAllDueReminders();
      });

      this.isRunning = true;
      logger.info('✅ Reminder scheduler started');
    } catch (error) {
      logger.error('Failed to start reminder scheduler:', error.message);
    }
  }

  /**
   * Stop the reminder scheduler
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.isRunning = false;
      logger.info('✅ Reminder scheduler stopped');
    }
  }

  /**
   * Check and send ALL due reminders
   * Called every minute by cron or externally by Vercel cron service
   */
  async checkAndSendAllDueReminders() {
    try {
      const now = new Date();
      logger.debug(`\n🔔 REMINDER CHECK: ${now.toISOString()}`);

      const reminders = await ReminderService.getReminders();
      
      if (reminders.length === 0) {
        logger.debug('No pending reminders found');
        return;
      }

      logger.info(`📋 Checking ${reminders.length} pending reminders at ${now.toISOString()}`);

      let sentCount = 0;
      let skippedCount = 0;

      for (const reminder of reminders) {
        try {
          const result = await this.processSingleReminder(reminder, now);
          if (result.sent) sentCount++;
          else skippedCount++;
        } catch (error) {
          logger.error('Error processing reminder:', {
            reminderId: reminder._id,
            error: error.message
          });
          skippedCount++;
        }
      }

      logger.info(`📊 Reminder check complete`, {
        checkTime: now.toISOString(),
        total: reminders.length,
        sent: sentCount,
        skipped: skippedCount
      });
    } catch (error) {
      logger.error('Failed to check reminders:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Process a single reminder
   * Returns { sent: boolean, reason: string }
   */
  async processSingleReminder(reminder, now) {
    const reminderTime = new Date(reminder.datetime);
    
    // Validation checks
    if (reminder.notified) {
      return { sent: false, reason: 'Already notified' };
    }

    if (reminder.status !== 'active') {
      return { sent: false, reason: `Status: ${reminder.status}` };
    }

    if (!reminder.userId?.phone) {
      logger.error('Reminder has no phone number:', { reminderId: reminder._id });
      return { sent: false, reason: 'No phone number' };
    }

    // Check time using timezone-aware logic (Asia/Kolkata)
    const dueTime = isReminderDue(reminder.datetime);
    const timeRemaining = getTimeRemaining(reminder.datetime);
    const kolkataTime = formatTimeInKolkata(reminder.datetime, 'HH:mm:ss');

    logger.debug('Processing reminder (Asia/Kolkata timezone):', {
      title: reminder.title,
      reminderTime: kolkataTime,
      timeStatus: timeRemaining,
      repeat: reminder.repeat,
      isDueTime: dueTime
    });

    // **ONE-TIME REMINDERS**: Send if within time window
    if (!reminder.repeat || reminder.repeat === 'none') {
      if (dueTime) {
        return await this.sendReminder(reminder);
      }
      return { sent: false, reason: `Not yet due (${timeRemaining})` };
    }

    // **REPEATING REMINDERS**: Check time match in Kolkata timezone
    if (reminder.repeat === 'daily') {
      const reminderDate = new Date(reminder.datetime);
      const targetHour = reminderDate.getUTCHours();
      const targetMinute = reminderDate.getUTCMinutes();
      
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      // Allow 1-minute window around target time
      if (currentHour === targetHour && Math.abs(currentMinute - targetMinute) <= 1) {
        return await this.sendReminder(reminder);
      }

      return { sent: false, reason: `Daily: waiting for ${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}` };
    }

    if (reminder.repeat === 'weekly') {
      const reminderDate = new Date(reminder.datetime);
      const targetDay = reminderDate.getUTCDay();
      const targetHour = reminderDate.getUTCHours();
      const targetMinute = reminderDate.getUTCMinutes();
      
      const now = new Date();
      const currentDay = now.getUTCDay();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      if (currentDay === targetDay && currentHour === targetHour && Math.abs(currentMinute - targetMinute) <= 1) {
        return await this.sendReminder(reminder);
      }

      return { sent: false, reason: `Weekly: waiting for matching day/time` };
    }

    return { sent: false, reason: `Repeat type: ${reminder.repeat}` };
  }

  /**
   * Send a single reminder via WhatsApp
   */
  async sendReminder(reminder) {
    try {
      const messageText = `⏰ ${reminder.title}${
        reminder.description ? '\n\n' + reminder.description : ''
      }`;

      logger.info('🚀 SENDING REMINDER:', {
        reminderId: reminder._id,
        to: reminder.userId.phone,
        title: reminder.title,
        time: new Date().toISOString()
      });

      // Send WhatsApp message
      await this.whatsappService.sendMessage(reminder.userId.phone, messageText);

      // Mark as notified
      await ReminderService.markNotified(reminder._id);

      logger.info('✅ REMINDER SENT:', {
        reminderId: reminder._id,
        phone: reminder.userId.phone,
        title: reminder.title,
        sentAt: new Date().toISOString()
      });

      return { sent: true, reason: 'Sent successfully' };
    } catch (error) {
      logger.error('Failed to send reminder:', {
        reminderId: reminder._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Manual check endpoint (for Vercel cron service)
   * Call this from external cron service to trigger reminder checks
   */
  async triggerManualCheck() {
    logger.info('🔔 Manual reminder check triggered');
    await this.checkAndSendAllDueReminders();
  }
}

export default ReminderScheduler;
