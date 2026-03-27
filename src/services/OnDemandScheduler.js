import ReminderService from './ReminderService.js';
import RoutineService from './RoutineService.js';
import WhatsAppService from './WhatsAppService.js';
import logger from '../utils/logger.js';

/**
 * On-Demand Scheduler
 * Runs opportunistically during webhook processing
 * Ideal for serverless platforms like Vercel
 * 
 * This replaces the cron-based scheduler for Vercel deployments
 */
export class OnDemandScheduler {
  constructor() {
    this.whatsappService = new WhatsAppService();
    this.lastCheckTime = {};
  }

  /**
   * Check for due reminders (called during webhook processing)
   * Prevents hammering DB by only checking once per minute per user
   */
  async checkAndSendDueReminders(userId) {
    try {
      const now = Date.now();
      const lastCheck = this.lastCheckTime[userId] || 0;
      
      // Only check once per minute per user
      if (now - lastCheck < 60000) {
        logger.debug('Skipping reminder check - already checked recently for user:', { userId });
        return;
      }
      
      this.lastCheckTime[userId] = now;

      const reminders = await ReminderService.getReminders();
      
      // Filter for this user and due reminders
      const userReminders = reminders.filter(r => r.userId._id.toString() === userId.toString());
      
      logger.debug(`📋 On-demand check for user ${userId}: ${userReminders.length} pending reminders`);

      for (const reminder of userReminders) {
        try {
          const shouldSend = this._shouldSendReminder(reminder);
          
          if (shouldSend) {
            const userPhone = reminder.userId?.phone;
            
            if (!userPhone) {
              logger.error('Reminder has no user phone:', { reminderId: reminder._id });
              continue;
            }
            
            // Send WhatsApp reminder
            await this.whatsappService.sendMessage(
              userPhone,
              `⏰ ${reminder.title}\n\n${reminder.description || ''}`
            );

            // Mark as notified
            await ReminderService.markNotified(reminder._id);

            logger.info('✅ On-demand reminder sent:', {
              reminderId: reminder._id,
              phone: userPhone,
              title: reminder.title,
              sentAt: new Date().toISOString()
            });
          }
        } catch (error) {
          logger.error('Failed to send on-demand reminder:', {
            reminderId: reminder._id,
            error: error.message
          });
        }
      }
    } catch (error) {
      logger.error('On-demand reminder check failed:', error.message);
    }
  }

  /**
   * Check if reminder should be sent based on time and repeat pattern
   */
  _shouldSendReminder(reminder) {
    const now = new Date();
    const reminderTime = new Date(reminder.datetime);
    
    // Already notified
    if (reminder.notified) {
      return false;
    }

    // Check if within 1 minute of reminder time
    const diffInMinutes = Math.abs(now - reminderTime) / 60000;
    
    if (diffInMinutes <= 1) {
      return true;
    }

    // For repeating reminders, check if it's the right time today
    if (reminder.repeat && reminder.repeat !== 'none') {
      const targetHour = reminderTime.getHours();
      const targetMinute = reminderTime.getMinutes();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (targetHour === currentHour && Math.abs(targetMinute - currentMinute) <= 1) {
        // Check if today is the right day
        if (this._isReminderDueToday(reminder)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if repeating reminder is due today
   */
  _isReminderDueToday(reminder) {
    const today = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    switch (reminder.repeat) {
      case 'daily':
        return true;
      
      case 'weekly':
        // If daysOfWeek is specified, check if today is included
        if (reminder.daysOfWeek && Array.isArray(reminder.daysOfWeek)) {
          const todayName = dayNames[today];
          return reminder.daysOfWeek.includes(todayName);
        }
        // Default: every 7 days from creation
        return true;
      
      case 'monthly':
        // Check if today is the same day of month as reminder creation
        const reminderDate = new Date(reminder.datetime);
        return reminderDate.getDate() === new Date().getDate();
      
      default:
        return false;
    }
  }

  /**
   * Check for due routines and send motivational reminders
   */
  async checkAndSendDueRoutines(userId) {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const routines = await RoutineService.getUserRoutines(userId);
      
      for (const routine of routines) {
        if (routine.active === false) continue;

        const [hour, minute] = routine.time.split(':').map(Number);

        // Check if routine time matches (within 1 minute)
        if (hour === currentHour && Math.abs(minute - currentMinute) <= 1) {
          // Check if routine is scheduled for today
          if (this._isRoutineDueToday(routine)) {
            const user = await this._getUserData(userId);
            const userPhone = user?.phone;

            if (userPhone) {
              const message = `🎯 It's ${routine.activity} time! Let's make it happen 💪\n\nReply with "done" when completed.`;
              
              await this.whatsappService.sendMessage(userPhone, message);
              
              logger.info('✅ Routine reminder sent:', {
                routineId: routine._id,
                activity: routine.activity,
                time: routine.time
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Routine check failed:', error.message);
    }
  }

  /**
   * Check if routine is scheduled for today
   */
  _isRoutineDueToday(routine) {
    const today = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today];

    if (routine.schedule === 'daily') {
      return true;
    }

    if (routine.schedule === 'weekly' && routine.daysOfWeek) {
      return routine.daysOfWeek.includes(todayName);
    }

    return true;
  }

  /**
   * Get user data (internal helper)
   */
  async _getUserData(userId) {
    // This should fetch user from DB
    // Implementation depends on your User model
    try {
      const User = (await import('../models/User.js')).default;
      return await User.findById(userId);
    } catch (error) {
      logger.error('Failed to get user data:', error.message);
      return null;
    }
  }
}

export default OnDemandScheduler;
