import mongoose from 'mongoose';
import logger from './logger.js';

export const connectDB = async () => {
  try {
    // Check if we have an existing connection
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      logger.debug('Using existing MongoDB connection');
      return mongoose.connection;
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Connect with options to handle serverless lifecycle
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'lifeos',
      connectTimeoutMS: 10000, // Terminate connection attempt after 10s
    });

    logger.info('✅ MongoDB connected successfully');
    return conn;
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', {
      message: error.message,
      stack: error.stack,
      env: process.env.NODE_ENV
    });
    // In serverless, we shouldn't exit the process. 
    // Throw error so the caller can handle it (e.g., return 500)
    throw error;
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('✅ MongoDB disconnected');
  } catch (error) {
    logger.error('❌ MongoDB disconnection failed:', error.message);
  }
};
