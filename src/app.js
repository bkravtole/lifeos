import express from 'express';
import dotenv from 'dotenv';
import { requestLogger, errorHandler } from './middleware/index.js';
import webhookRoutes from './api/webhook.js';
import apiRoutes from './api/index.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ROOT endpoint - always works
app.get('/', (req, res) => {
  console.log('🟢 ROOT endpoint hit');
  logger.info('✅ ROOT endpoint hit');
  res.status(200).json({
    status: 'alive',
    message: 'LifeOS API is running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🟢 Health check hit');
  logger.info('✅ Health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api', apiRoutes);

// Error handling
app.use(errorHandler);

export default app;
