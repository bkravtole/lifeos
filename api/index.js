import app from '../src/app.js';
import { connectDB } from '../src/utils/database.js';
import logger from '../src/utils/logger.js';

// Log when the handler is called
console.log('🟢 Vercel handler loaded');

// Initialize database connection on first request
let isDBInitialized = false;

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  if (!isDBInitialized) {
    try {
      await connectDB();
      isDBInitialized = true;
      logger.info('✅ Database initialized on Vercel');
    } catch (error) {
      logger.error('Failed to initialize database on Vercel:', error.message);
      // Continue anyway - might reconnect on next request
    }
  }
  next();
});

export default app;
