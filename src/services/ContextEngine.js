import Conversation from '../models/Conversation.js';
import logger from '../utils/logger.js';

/**
 * Context Engine
 * Manages user context and conversation memory
 */
export class ContextEngine {
  /**
   * Get or create conversation context
   */
  static async getContext(userId) {
    try {
      let conversation = await Conversation.findOne({ userId });

      if (!conversation) {
        conversation = new Conversation({
          userId,
          messages: [],
          context: {
            lastActivity: null,
            missedActivities: [],
            preferences: {}
          }
        });
        await conversation.save();
      }

      return conversation;
    } catch (error) {
      logger.error('Failed to get context:', error.message);
      throw error;
    }
  }

  /**
   * Add message to conversation
   */
  static async addMessage(userId, role, content) {
    try {
      const conversation = await this.getContext(userId);
      conversation.messages.push({
        role,
        content,
        timestamp: new Date()
      });

      await conversation.save();
      return conversation;
    } catch (error) {
      logger.error('Failed to add message:', error.message);
      throw error;
    }
  }

  /**
   * Update context
   */
  static async updateContext(userId, contextData) {
    try {
      const conversation = await Conversation.findOneAndUpdate(
        { userId },
        { context: contextData },
        { new: true }
      );

      logger.info('Context updated:', { userId });
      return conversation;
    } catch (error) {
      logger.error('Failed to update context:', error.message);
      throw error;
    }
  }

  /**
   * Get conversation summary for AI
   */
  static async getConversationSummary(userId, limit = 10) {
    try {
      const conversation = await this.getContext(userId);
      const recentMessages = conversation.messages.slice(-limit);

      return {
        context: conversation.context,
        recentMessages,
        summary: conversation.summary
      };
    } catch (error) {
      logger.error('Failed to get conversation summary:', error.message);
      throw error;
    }
  }

  /**
   * Clear old messages (cleanup)
   */
  static async clearOldMessages(userId, daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const conversation = await Conversation.findOne({ userId });
      if (!conversation) return;

      conversation.messages = conversation.messages.filter(
        m => new Date(m.timestamp) >= cutoffDate
      );

      await conversation.save();
      logger.info('Old messages cleared:', { userId, daysToKeep });
      return conversation;
    } catch (error) {
      logger.error('Failed to clear old messages:', error.message);
      throw error;
    }
  }
}

export default ContextEngine;
