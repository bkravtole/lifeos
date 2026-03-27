import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './utils/database.js';
import { requestLogger, errorHandler } from './middleware/index.js';
import webhookRoutes from './api/webhook.js';
import apiRoutes from './api/index.js';
import SchedulerService from './services/SchedulerService.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api', apiRoutes);

// Error handling
app.use(errorHandler);

// Initialize scheduler
const scheduler = new SchedulerService();

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Initialize scheduler
    await scheduler.initialize();

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
