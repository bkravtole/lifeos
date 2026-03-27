import logger from '../utils/logger.js';

/**
 * Webhook Signature Verification Middleware
 */
export const verifyWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-11za-signature'];
    const token = process.env.WHATSAPP_WEBHOOK_TOKEN;

    // TODO: Implement proper HMAC verification with 11za
    // For now, basic token check
    if (!signature || signature !== token) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  } catch (error) {
    logger.error('Signature verification failed:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('Request error:', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    timestamp: new Date()
  });
};

/**
 * Request Logging Middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed:', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

export default {
  verifyWebhookSignature,
  errorHandler,
  requestLogger
};
