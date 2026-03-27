import app from './app.js';
import { connectDB } from './utils/database.js';
import ReminderScheduler from './services/ReminderScheduler.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;
const reminderScheduler = new ReminderScheduler();

/**
 * Start server (Local development + Vercel)
 */
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info('✅ Database connected');

    // Start reminder scheduler for local development
    // On Vercel, this won't run, but /webhook/trigger-reminders can be called by external cron service
    if (process.env.NODE_ENV !== 'production') {
      reminderScheduler.start();
      logger.info('✅ Reminder scheduler started (local mode)');
    } else {
      logger.info('ℹ️ Running in production mode - use external cron service to call /webhook/trigger-reminders');
    }

    // Start Express server
    app.listen(PORT, process.env.HOST || 'localhost', () => {
      logger.info(`🚀 LifeOS WhatsApp AI Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  reminderScheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  reminderScheduler.stop();
  process.exit(0);
});

startServer();

export default app;
