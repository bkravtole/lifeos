import Goal from '../models/Goal.js';
import ReminderService from './ReminderService.js';
import RoutineService from './RoutineService.js';
import MemoryService from './MemoryService.js';
import logger from '../utils/logger.js';
import { parseTimeInKolkata } from '../utils/timezone.js';

/**
 * Goal Service
 * Manages goal creation, AI-powered breakdown, and progress tracking
 */
export class GoalService {

  /**
   * Create a new goal (without sub-tasks yet)
   */
  static async createGoal(userId, { title, description, deadline, category }) {
    try {
      const goal = new Goal({
        userId,
        title,
        description,
        deadline: deadline || null,
        category: category || MemoryService._categorizeActivity(title),
        subTasks: [],
        status: 'active'
      });

      await goal.save();
      logger.info('🎯 Goal created:', { goalId: goal._id, title });

      // Learn this as a fact about the user
      await MemoryService.learn(userId, {
        type: 'fact',
        content: `User has a goal: ${title}${deadline ? ' (deadline: ' + deadline + ')' : ''}`,
        category: goal.category,
        source: 'goal',
        relatedActivity: title.toLowerCase()
      });

      return goal;
    } catch (error) {
      logger.error('Failed to create goal:', error.message);
      throw error;
    }
  }

  /**
   * Set sub-tasks on a goal (from AI breakdown)
   */
  static async setSubTasks(goalId, subTasks) {
    try {
      const goal = await Goal.findByIdAndUpdate(
        goalId,
        { subTasks },
        { new: true }
      );
      logger.info('🎯 Sub-tasks set:', { goalId, count: subTasks.length });
      return goal;
    } catch (error) {
      logger.error('Failed to set sub-tasks:', error.message);
      throw error;
    }
  }

  /**
   * Convert sub-tasks into actual Reminders and Routines in the system
   */
  static async convertSubTasksToActions(userId, goalId) {
    try {
      const goal = await Goal.findById(goalId);
      if (!goal) throw new Error('Goal not found');

      const results = { reminders: 0, routines: 0 };

      for (let i = 0; i < goal.subTasks.length; i++) {
        const task = goal.subTasks[i];

        if (task.type === 'routine' || task.schedule === 'daily') {
          // Parse time and extract HH:mm for Routine
          const parsedIsoTime = parseTimeInKolkata(task.time || '9:00 AM');
          const hhmmTime = parsedIsoTime ? parsedIsoTime.substring(11, 16) : '09:00';
          
          // Create a routine
          const routine = await RoutineService.createRoutine(userId, {
            activity: task.title,
            schedule: task.schedule || 'daily',
            time: hhmmTime,
            description: `Part of goal: ${goal.title}`
          });
          goal.subTasks[i].linkedRoutineId = routine._id;
          goal.subTasks[i].status = 'active';
          results.routines++;
        } else {
          // Create a one-time reminder
          const parsedTime = parseTimeInKolkata(task.time || '9:00 AM');
          const reminder = await ReminderService.createReminder(userId, {
            activity: task.title,
            title: task.title,
            datetime: parsedTime,
            repeat: 'none',
            description: `Part of goal: ${goal.title}`
          });
          goal.subTasks[i].linkedReminderId = reminder._id;
          goal.subTasks[i].status = 'active';
          results.reminders++;
        }
      }

      await goal.save();
      logger.info('🎯 Sub-tasks converted to actions:', { goalId, ...results });
      return { goal, ...results };
    } catch (error) {
      logger.error('Failed to convert sub-tasks:', error.message);
      throw error;
    }
  }

  /**
   * Get all active goals for a user
   */
  static async getUserGoals(userId) {
    try {
      return await Goal.find({ userId, status: 'active' }).sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Failed to get user goals:', error.message);
      return [];
    }
  }

  /**
   * Update goal progress (auto-calculate from completed sub-tasks)
   */
  static async updateProgress(goalId) {
    try {
      const goal = await Goal.findById(goalId);
      if (!goal || goal.subTasks.length === 0) return goal;

      const completed = goal.subTasks.filter(t => t.status === 'completed').length;
      goal.progress = Math.round((completed / goal.subTasks.length) * 100);

      if (goal.progress >= 100) {
        goal.status = 'completed';
      }

      await goal.save();
      logger.info('🎯 Goal progress updated:', { goalId, progress: goal.progress });
      return goal;
    } catch (error) {
      logger.error('Failed to update progress:', error.message);
      return null;
    }
  }

  /**
   * Update a goal details
   */
  static async updateGoal(goalId, data) {
    try {
      const goal = await Goal.findByIdAndUpdate(goalId, data, { new: true });
      logger.info('🎯 Goal updated:', { goalId });
      return goal;
    } catch (error) {
      logger.error('Failed to update goal:', error.message);
      throw error;
    }
  }

  /**
   * Delete a goal and its associated tasks
   */
  static async deleteGoal(goalId) {
    try {
      const goal = await Goal.findById(goalId);
      if (!goal) return { success: false, error: 'Goal not found' };

      // Delete associated routines and reminders
      for (const task of goal.subTasks) {
        try {
          if (task.linkedRoutineId) {
            await RoutineService.deleteRoutine(task.linkedRoutineId);
          }
          if (task.linkedReminderId) {
            await ReminderService.deleteReminder(task.linkedReminderId);
          }
        } catch (e) {
          logger.warn(`Failed to delete linked task ${task.title}:`, e.message);
        }
      }

      await Goal.findByIdAndDelete(goalId);
      logger.info('🎯 Goal and subtasks deleted:', { goalId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete goal:', error.message);
      throw error;
    }
  }
}

export default GoalService;
