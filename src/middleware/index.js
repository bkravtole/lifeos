import logger from '../utils/logger.js';

/**
 * Webhook Signature Verification Middleware
 * Validates x-api-key header against ELEVENZA_WEBHOOK_SECRET
 */
export const verifyWebhookSignature = (req, res, next) => {
  try {
    const expectedSecret = process.env.ELEVENZA_WEBHOOK_SECRET;

    if (expectedSecret) {
      const incomingToken = req.headers['x-api-key'];

      if (incomingToken !== expectedSecret) {
        logger.warn('❌ UNAUTHORIZED: Invalid Webhook Request. Headers mismatch.', {
          received: incomingToken ? 'present' : 'missing',
          expected: 'present'
        });
        // Returning 200 to prevent retries from webhook provider
        return res.status(200).send('Unauthorized but acknowledged');
      }

      logger.debug('✅ Webhook signature verified', {
        source: 'x-api-key header'
      });
    } else {
      logger.warn('⚠️  ELEVENZA_WEBHOOK_SECRET not configured, webhook verification skipped');
    }

    next();
  } catch (error) {
    logger.error('Webhook verification failed:', error.message);
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
