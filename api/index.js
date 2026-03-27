import app from '../src/app.js';
import SchedulerService from '../src/services/SchedulerService.js';
import logger from '../src/utils/logger.js';
import { connectDB } from '../src/utils/database.js';

// Log when the handler is called
console.log('🟢 Vercel handler loaded');

// Scheduler instance (persists across handler invocations)
let schedulerInstance = null;
let isSchedulerInitialized = false;

// Initialize scheduler on first request
async function initializeScheduler() {
  if (isSchedulerInitialized) return;
  
  try {
    await connectDB();
    schedulerInstance = new SchedulerService();
    await schedulerInstance.initialize();
    isSchedulerInitialized = true;
    logger.info('✅ Scheduler initialized on Vercel');
  } catch (error) {
    logger.error('Failed to initialize scheduler on Vercel:', error.message);
  }
}

// Middleware to ensure scheduler is initialized
app.use(async (req, res, next) => {
  if (!isSchedulerInitialized) {
    await initializeScheduler();
  }
  next();
});

export default app;
