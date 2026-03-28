import UserMemory from '../models/UserMemory.js';
import ActivityLog from '../models/ActivityLog.js';
import RoutineService from './RoutineService.js';
import logger from '../utils/logger.js';

/**
 * Memory Service
 * Manages long-term user memory: habits, preferences, patterns, facts
 */
export class MemoryService {

  /**
   * Learn or reinforce a memory about the user
   */
  static async learn(userId, { type, content, category, source, relatedActivity }) {
    try {
      // Check for existing similar memory
      const existing = await UserMemory.findOne({
        userId,
        type,
        relatedActivity: relatedActivity || undefined,
        content: { $regex: new RegExp(content.substring(0, 30), 'i') }
      });

      if (existing) {
        // Reinforce existing memory
        existing.reinforceCount += 1;
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        existing.lastReinforcedAt = new Date();
        await existing.save();
        logger.info('🧠 Memory reinforced:', { id: existing._id, confidence: existing.confidence });
        return existing;
      }

      // Create new memory
      const memory = new UserMemory({
        userId,
        type,
        content,
        category: category || 'general',
        source: source || 'inferred',
        relatedActivity,
        confidence: 0.3
      });

      await memory.save();
      logger.info('🧠 New memory learned:', { id: memory._id, type, content: content.substring(0, 50) });
      return memory;
    } catch (error) {
      logger.error('Failed to learn memory:', error.message);
      return null;
    }
  }

  /**
   * Recall all memories for a user (optionally filtered by type)
   */
  static async recall(userId, type = null) {
    try {
      const filter = { userId, isActive: true };
      if (type) filter.type = type;

      return await UserMemory.find(filter)
        .sort({ confidence: -1, lastReinforcedAt: -1 })
        .limit(20);
    } catch (error) {
      logger.error('Failed to recall memories:', error.message);
      return [];
    }
  }

  /**
   * Build a memory context string for AI prompts
   * Returns a text block like:
   *   "User goes to gym daily (high confidence)"
   *   "User prefers reminders in Hinglish"
   */
  static async buildMemoryContext(userId) {
    try {
      const memories = await this.recall(userId);
      if (!memories || memories.length === 0) return '';

      let context = '\n\nLONG-TERM MEMORY (things I know about this user):';

      const habits = memories.filter(m => m.type === 'habit');
      const preferences = memories.filter(m => m.type === 'preference');
      const patterns = memories.filter(m => m.type === 'pattern');
      const facts = memories.filter(m => m.type === 'fact');

      if (habits.length > 0) {
        context += '\n  Habits:';
        habits.forEach(h => {
          const conf = h.confidence >= 0.7 ? '✅' : h.confidence >= 0.4 ? '🔶' : '❓';
          context += `\n  ${conf} ${h.content}`;
        });
      }

      if (preferences.length > 0) {
        context += '\n  Preferences:';
        preferences.forEach(p => context += `\n  - ${p.content}`);
      }

      if (patterns.length > 0) {
        context += '\n  Patterns:';
        patterns.forEach(p => context += `\n  - ${p.content}`);
      }

      if (facts.length > 0) {
        context += '\n  Facts:';
        facts.forEach(f => context += `\n  - ${f.content}`);
      }

      return context;
    } catch (error) {
      logger.error('Failed to build memory context:', error.message);
      return '';
    }
  }

  /**
   * Auto-learn from activity logs (call periodically or after activity log)
   * Analyzes recent activity to detect habits
   */
  static async learnFromActivity(userId, activityName, status) {
    try {
      if (status !== 'done') return;

      // Count how many times this activity was done in the last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const count = await ActivityLog.countDocuments({
        userId,
        activity: { $regex: new RegExp(activityName, 'i') },
        status: 'done',
        date: { $gte: weekAgo }
      });

      // If done 3+ times in 7 days, learn as habit
      if (count >= 3) {
        await this.learn(userId, {
          type: 'habit',
          content: `User does ${activityName} regularly (${count} times this week)`,
          category: this._categorizeActivity(activityName),
          source: 'activity',
          relatedActivity: activityName.toLowerCase()
        });
      }
    } catch (error) {
      logger.error('Failed to learn from activity:', error.message);
    }
  }

  /**
   * Detect missed habits — compare routines vs today's activity logs
   * Returns array of { activity, lastDone, streakBroken }
   */
  static async detectMissedHabits(userId) {
    try {
      const habits = await UserMemory.find({
        userId,
        type: 'habit',
        isActive: true,
        confidence: { $gte: 0.4 }
      });

      if (habits.length === 0) return [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const missed = [];

      for (const habit of habits) {
        if (!habit.relatedActivity) continue;

        // Check if this activity was done today
        const doneToday = await ActivityLog.findOne({
          userId,
          activity: { $regex: new RegExp(habit.relatedActivity, 'i') },
          status: 'done',
          date: { $gte: todayStart }
        });

        if (!doneToday) {
          // Find when it was last done
          const lastDone = await ActivityLog.findOne({
            userId,
            activity: { $regex: new RegExp(habit.relatedActivity, 'i') },
            status: 'done'
          }).sort({ date: -1 });

          missed.push({
            activity: habit.relatedActivity,
            content: habit.content,
            confidence: habit.confidence,
            lastDone: lastDone?.date || null
          });
        }
      }

      return missed;
    } catch (error) {
      logger.error('Failed to detect missed habits:', error.message);
      return [];
    }
  }

  /**
   * Simple activity categorizer
   */
  static _categorizeActivity(activity) {
    const lower = activity.toLowerCase();
    if (/gym|workout|exercise|run|jog|walk|yoga|pushup|squat/.test(lower)) return 'fitness';
    if (/study|exam|read|book|course|learn|class/.test(lower)) return 'study';
    if (/water|drink|eat|diet|meal|food|breakfast|lunch|dinner/.test(lower)) return 'health';
    if (/meditat|pray|journal|gratitude/.test(lower)) return 'wellness';
    if (/work|office|meeting|project|client|task/.test(lower)) return 'work';
    if (/call|message|friend|family/.test(lower)) return 'social';
    return 'general';
  }
}

export default MemoryService;
