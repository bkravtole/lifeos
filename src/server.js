import app from './app.js';
import { connectDB } from './utils/database.js';
import SchedulerService from './services/SchedulerService.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;
const scheduler = new SchedulerService();

/**
 * Start server (Local development only)
 */
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info('✅ Database connected');

    // Initialize scheduler
    await scheduler.initialize();
    logger.info('✅ Scheduler initialized');

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
  scheduler.stopAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  scheduler.stopAll();
  process.exit(0);
});

startServer();

export default app;
