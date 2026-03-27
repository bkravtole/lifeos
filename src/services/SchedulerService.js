import cron from 'node-cron';
import ReminderService from './ReminderService.js';
import RoutineService from './RoutineService.js';
import WhatsAppService from './WhatsAppService.js';
import logger from '../utils/logger.js';

/**
 * Scheduler Service
 * Manages cron jobs for reminders and routines
 */
export class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Initialize scheduler
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Scheduler Service...');

      // Check reminders every minute
      this.scheduleReminders();

      // Check routines every minute
      this.scheduleRoutines();

      logger.info('✅ Scheduler initialized');
    } catch (error) {
      logger.error('Failed to initialize scheduler:', error.message);
    }
  }

  /**
   * Schedule reminder checks (every minute)
   */
  scheduleReminders() {
    const job = cron.schedule('* * * * *', async () => {
      try {
        const reminders = await ReminderService.getRemindersdue();

        for (const reminder of reminders) {
          try {
            // Check if reminder should be sent based on repeat pattern
            if (this.shouldSendReminder(reminder)) {
              // Get user phone from populated userId
              const userPhone = reminder.userId?.phone;
              
              if (userPhone) {
                // Send WhatsApp reminder
                await this.whatsappService.sendMessage(
                  userPhone,
                  `⏰ ${reminder.title}\n\n${reminder.description || ''}`
                );

                // Mark as notified
                await ReminderService.markNotified(reminder._id);

                logger.info('Reminder sent:', {
                  reminderId: reminder._id,
                  phone: userPhone,
                  title: reminder.title
                });
              }
            }
          } catch (error) {
            logger.error('Failed to send reminder:', error.message);
          }
        }
      } catch (error) {
        logger.error('Reminder check failed:', error.message);
      }
    });

    this.jobs.set('reminders', job);
  }

  /**
   * Check if reminder should be sent based on repeat pattern
   */
  shouldSendReminder(reminder) {
    const now = new Date();
    const reminderTime = new Date(reminder.datetime);
    
    // Check if current time matches reminder time (hour and minute)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const reminderHour = reminderTime.getHours();
    const reminderMinute = reminderTime.getMinutes();
    
    // Time matches if hour and minute are the same
    if (currentHour !== reminderHour || currentMinute !== reminderMinute) {
      return false;
    }
    
    // Check repeat pattern
    if (reminder.repeat === 'daily') {
      return true; // Send every day at this time
    } else if (reminder.repeat === 'weekly') {
      // Send if today is the same day of week as reminder date
      return now.getDay() === reminderTime.getDay();
    } else if (reminder.repeat === 'monthly') {
      // Send if today is the same date of month as reminder date
      return now.getDate() === reminderTime.getDate();
    } else {
      // 'none' - send only once if not yet notified
      return !reminder.notified && reminderTime <= now;
    }
  }

  /**
   * Schedule routine checks (every minute)
   */
  scheduleRoutines() {
    const job = cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        const routines = await RoutineService.getRoutinesDue(hour, minute);

        for (const routine of routines) {
          try {
            const message = `💪 ये देखो! ${routine.activity} करने का समय हो गया!\n\nआपने यह आज कर लिया?`;

            // Send interactive button message with 11za format
            const buttons = [
              {
                payload: 'activity_done_' + routine._id,
                title: '✅ हाँ'
              },
              {
                payload: 'activity_skipped_' + routine._id,
                title: '❌ नहीं'
              }
            ];

            await this.whatsappService.sendButtonMessage(
              routine.userId?.phone,
              message,
              buttons
            );

            logger.info('Routine reminder sent:', {
              routineId: routine._id,
              phone: routine.userId?.phone
            });
          } catch (error) {
            logger.error('Failed to send routine reminder:', error.message);
          }
        }
      } catch (error) {
        logger.error('Routine check failed:', error.message);
      }
    });

    this.jobs.set('routines', job);
  }

  /**
   * Stop all jobs
   */
  stopAll() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info('Job stopped:', name);
    });
    this.jobs.clear();
  }

  /**
   * Get job status
   */
  getJobStatus(jobName) {
    const job = this.jobs.get(jobName);
    return {
      name: jobName,
      active: job ? !job._destroyed : false
    };
  }
}

export default SchedulerService;
