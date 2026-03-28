import ReminderService from './ReminderService.js';
import RoutineService from './RoutineService.js';
import ActivityService from './ActivityService.js';
import WhatsAppService from './WhatsAppService.js';
import logger from '../utils/logger.js';
import { isReminderDue, getTimeRemaining, formatTimeInKolkata, getCurrentTimeInKolkata } from '../utils/timezone.js';

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
   * Check and send ALL due reminders (can be called from webhook or external cron)
   */
  async checkAndSendAllDueReminders() {
    try {
      const now = Date.now();
      this.lastCheckTime.global = now;

      const reminders = await ReminderService.getReminders();

      logger.info(`🔔 On-demand check: ${reminders.length} reminders found`, {
        checkTime: new Date().toISOString()
      });

      let sentCount = 0;

      for (const reminder of reminders) {
        try {
          const shouldSend = await this._shouldSendReminder(reminder);

          logger.debug('Reminder evaluation:', {
            reminderId: reminder._id,
            title: reminder.title,
            shouldSend
          });

          if (shouldSend) {
            const userPhone = reminder.userId?.phone;

            if (!userPhone) {
              logger.error('Reminder has no phone:', { reminderId: reminder._id });
              continue;
            }

            logger.info('🚀 SENDING REMINDER:', {
              reminderId: reminder._id,
              title: reminder.title,
              to: userPhone
            });

            await this.whatsappService.sendMessage(
              userPhone,
              `⏰ ${reminder.title}\n\n${reminder.description || ''}`
            );

            await ReminderService.markNotified(reminder._id);
            sentCount++;

            logger.info('✅ Reminder sent:', {
              reminderId: reminder._id,
              phone: userPhone,
              sentAt: new Date().toISOString()
            });
          }
        } catch (error) {
          logger.error('Failed to send reminder:', {
            reminderId: reminder._id,
            error: error.message
          });
        }
      }

      logger.info(`📊 On-demand check complete: ${sentCount}/${reminders.length} sent`);
    } catch (error) {
      logger.error('On-demand check failed:', error.message, error.stack);
    }
  }

  /**
   * Check for due reminders for specific user (called during webhook)
   * Replacement for deprecated checkAndSendDueReminders
   */
  async checkAndSendDueReminders(userId) {
    try {
      const now = Date.now();
      const lastCheck = this.lastCheckTime[userId] || 0;

      this.lastCheckTime[userId] = now;

      const reminders = await ReminderService.getReminders();

      const userReminders = reminders.filter(r => {
        if (!r.userId) return false;
        return r.userId._id.toString() === userId.toString();
      });

      logger.debug(`📋 User reminder check: ${userReminders.length} reminders`, {
        userId,
        checkTime: new Date().toISOString()
      });

      for (const reminder of userReminders) {
        try {
          const shouldSend = await this._shouldSendReminder(reminder);

          if (shouldSend) {
            const userPhone = reminder.userId?.phone;

            if (!userPhone) {
              logger.error('Reminder missing phone:', { reminderId: reminder._id });
              continue;
            }

            await this.whatsappService.sendMessage(
              userPhone,
              `⏰ ${reminder.title}\n\n${reminder.description || ''}`
            );

            await ReminderService.markNotified(reminder._id);

            // Log activity for reminder sent
            try {
              await ActivityService.logActivity(
                reminder.userId._id,
                reminder.title,
                'reminded',
                {
                  date: new Date(),
                  notes: `Reminder sent via WhatsApp`
                }
              );
            } catch (logError) {
              logger.warn('Failed to log reminder activity:', logError.message);
            }

            logger.info('✅ User reminder sent:', {
              reminderId: reminder._id,
              userId,
              sentAt: new Date().toISOString()
            });
          }
        } catch (error) {
          logger.error('Failed to process user reminder:', {
            reminderId: reminder._id,
            error: error.message
          });
        }
      }
    } catch (error) {
      logger.error('User reminder check failed:', error.message, error.stack);
    }
  }

  /**
   * Check if reminder should be sent (timezone-aware: Asia/Kolkata)
   * For one-time: send once when time is reached
   * For daily/repeating: reset daily at midnight and send when time is reached each day
   */
  async _shouldSendReminder(reminder) {
    // Already notified - but check if it's a daily reminder from a previous day
    if (reminder.notified) {
      // For daily reminders, check if we need to reset (new day)
      if (reminder.repeat === 'daily' && reminder.notifiedAt) {
        const notifiedDate = new Date(reminder.notifiedAt);
        const today = new Date();

        // If notified on a previous day, reset the flag in DB so it fires today
        if (notifiedDate.toDateString() !== today.toDateString()) {
          logger.info('🔄 Daily reminder reset (new day detected) - resetting notified flag', {
            reminderId: reminder._id,
            lastSent: notifiedDate.toDateString(),
            today: today.toDateString()
          });
          // Bug 5 Fix: Actually reset the flag in the DB (previously only logged, never wrote)
          try {
            const Reminder = (await import('../models/Reminder.js')).default;
            await Reminder.findByIdAndUpdate(reminder._id, { notified: false, notifiedAt: null });
            // Mutate in-memory too so the rest of the function sees updated state
            reminder.notified = false;
          } catch (resetError) {
            logger.error('Failed to reset daily reminder notified flag:', resetError.message);
            return false; // Skip this check; will retry next cycle
          }
        } else {
          // Already sent today, skip
          logger.debug('Daily reminder already sent today, skipping', { reminderId: reminder._id });
          return false;
        }
      } else if (reminder.repeat !== 'daily' && reminder.repeat !== 'weekly' && reminder.repeat !== 'monthly') {
        // One-time reminder already sent, skip
        logger.debug('Reminder already notified, skipping', { reminderId: reminder._id });
        return false;
      }
    }

    // Skip if status is not active
    if (reminder.status !== 'active') {
      logger.debug('Reminder status not active', { reminderId: reminder._id, status: reminder.status });
      return false;
    }

    // Check if reminder is due using timezone-aware comparison
    const isDue = isReminderDue(reminder.datetime);
    const timeRemaining = getTimeRemaining(reminder.datetime);
    const kolkataTime = formatTimeInKolkata(reminder.datetime, 'HH:mm:ss');

    logger.debug('Reminder time check (Asia/Kolkata):', {
      reminderId: reminder._id,
      reminderTime: kolkataTime,
      timeStatus: timeRemaining,
      isDue
    });

    if (isDue) {
      logger.info('✅ Reminder time matched (Asia/Kolkata)!', {
        reminderId: reminder._id,
        reminderTime: kolkataTime,
        status: timeRemaining
      });
      return true;
    }

    // For repeating reminders, check if it's the right time (by hour:minute)
    if (reminder.repeat && reminder.repeat !== 'none') {
      // Parse time from the stored string format
      let targetHour, targetMinute;

      if (typeof reminder.datetime === 'string') {
        const match = reminder.datetime.match(/T(\d{2}):(\d{2}):/);
        if (match) {
          targetHour = parseInt(match[1]);
          targetMinute = parseInt(match[2]);
        }
      }

      // Bug 4 Fix: Declare kolkataHours/kolkataMinutes BEFORE inner if-block
      // so the else-branch debug log below doesn't cause a ReferenceError.
      const nowUtc2 = new Date();
      let kolkataHours = nowUtc2.getUTCHours() + 5;
      let kolkataMinutes = nowUtc2.getUTCMinutes() + 30;
      if (kolkataMinutes >= 60) {
        kolkataHours += 1;
        kolkataMinutes -= 60;
      }
      kolkataHours = kolkataHours % 24;

      if (targetHour !== undefined && targetMinute !== undefined) {
        // For repeating reminders, check if we're at or after the scheduled time (same hour)
        // This uses the same logic as one-time reminders but for daily checks
        const targetTotalMinutes = targetHour * 60 + targetMinute;
        const currentTotalMinutes = kolkataHours * 60 + kolkataMinutes;

        // Send if current time is at or after the scheduled time (but only once per day)
        // The notified flag prevents it from sending multiple times per day
        if (currentTotalMinutes >= targetTotalMinutes) {
          logger.info('✅ Repeating reminder time matched (at or after):', {
            reminderId: reminder._id,
            repeat: reminder.repeat,
            scheduledTime: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`,
            currentTime: `${String(kolkataHours).padStart(2, '0')}:${String(kolkataMinutes).padStart(2, '0')}`
          });
          return true;
        }
      }

      logger.debug('Repeating reminder not due yet (before scheduled time):', {
        reminderId: reminder._id,
        repeat: reminder.repeat,
        scheduledTime: targetHour !== undefined ? `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}` : 'unknown',
        currentTime: `${String(kolkataHours).padStart(2, '0')}:${String(kolkataMinutes).padStart(2, '0')}`
      });
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
