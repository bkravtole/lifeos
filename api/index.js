import app from '../src/app.js';
import logger from '../src/utils/logger.js';

// Initialize database and scheduler on first request
let initialized = false;

app.use(async (req, res, next) => {
  if (!initialized) {
    try {
      logger.info('🔄 Initializing app on first request...');
      
      const { connectDB } = await import('../src/utils/database.js');
      const SchedulerService = await import('../src/services/SchedulerService.js').then(m => m.default);
      
      // Connect to database
      await connectDB();
      logger.info('✅ Database connected');
      
      // Initialize scheduler
      const scheduler = new SchedulerService();
      await scheduler.initialize();
      logger.info('✅ Scheduler initialized');
      
      initialized = true;
      logger.info('✅ App fully initialized on Vercel');
    } catch (error) {
      logger.error('❌ Failed to initialize:', error.message);
      return res.status(500).json({ error: 'Initialization failed', message: error.message });
    }
  }
  next();
});

export default app;
