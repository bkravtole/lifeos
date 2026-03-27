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

// Health check endpoint (this runs immediately)
app.get('/api/health', (req, res) => {
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
