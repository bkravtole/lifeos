import User from '../models/User.js';
import Reminder from '../models/Reminder.js';
import Routine from '../models/Routine.js';
import ActivityLog from '../models/ActivityLog.js';
import Conversation from '../models/Conversation.js';
import logger from '../utils/logger.js';

/**
 * Database Seeding for Development
 * Creates sample data for testing
 */

export const seedDatabase = async () => {
  try {
    logger.info('🌱 Seeding database...');

    // Create sample user
    const user = await User.create({
      phone: '919876543210',
      name: 'Rahul Kumar',
      timezone: 'Asia/Kolkata',
      preferences: {
        language: 'hi',
        notificationsEnabled: true
      }
    });

    logger.info('User created:', { userId: user._id });

    // Create sample reminders
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await Reminder.create([
      {
        userId: user._id,
        title: 'Morning Walk',
        datetime: tomorrow,
        repeat: 'daily',
        priority: 'high',
        status: 'active'
      },
      {
        userId: user._id,
        title: 'Gym Session',
        datetime: new Date(tomorrow.getTime() + 12 * 60 * 60 * 1000),
        repeat: 'daily',
        priority: 'medium',
        status: 'active'
      }
    ]);

    logger.info('Reminders created');

    // Create sample routines
    await Routine.create({
      userId: user._id,
      activity: 'Morning Exercise',
      schedule: 'daily',
      time: '06:00',
      description: 'Daily morning workout'
    });

    logger.info('Routines created');

    // Create sample activity logs
    await ActivityLog.create([
      {
        userId: user._id,
        activity: 'Morning Walk',
        status: 'done',
        duration: 30
      },
      {
        userId: user._id,
        activity: 'Gym',
        status: 'done',
        duration: 60
      }
    ]);

    logger.info('Activity logs created');

    // Create conversation context
    await Conversation.create({
      userId: user._id,
      messages: [
        {
          role: 'user',
          content: 'नमस्ते! मैं LifeOS के साथ शुरुआत करना चाहता हूं।'
        },
        {
          role: 'assistant',
          content: 'स्वागत है! मैं आपके दैनिक जीवन को ट्रैक करने में मदद करूंगा। 🎯'
        }
      ],
      context: {
        lastActivity: 'Morning Walk',
        missedActivities: [],
        preferences: { remindersAt: '6am' }
      }
    });

    logger.info('✅ Database seeding completed');
  } catch (error) {
    logger.error('❌ Database seeding failed:', error.message);
    throw error;
  }
};

export default seedDatabase;
