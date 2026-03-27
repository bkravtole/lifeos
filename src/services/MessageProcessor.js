import logger from '../utils/logger.js';

/**
 * Message Processor
 * Converts raw WhatsApp message into structured format
 */
export class MessageProcessor {
  static process(rawMessage) {
    try {
      const { from, text, timestamp, type = 'text' } = rawMessage;

      if (!from || !text) {
        throw new Error('Missing required fields: from, text');
      }

      return {
        userId: from,
        text: text.trim(),
        timestamp: timestamp || new Date(),
        type,
        processedAt: new Date()
      };
    } catch (error) {
      logger.error('Message processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate message structure
   */
  static validate(message) {
    const requiredFields = ['userId', 'text'];
    return requiredFields.every(field => message[field]);
  }
}

export default MessageProcessor;
