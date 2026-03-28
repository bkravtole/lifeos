import Routine from '../models/Routine.js';
import logger from '../utils/logger.js';

/**
 * Routine Service
 * Manages daily/weekly routines
 */
export class RoutineService {
  /**
   * Create routine
   */
  static async createRoutine(userId, data) {
    try {
      const routine = new Routine({
        userId,
        activity: data.activity,
        schedule: data.schedule || 'daily',
        time: data.time,
        daysOfWeek: data.daysOfWeek,
        description: data.description,
        streak: 0,
        lastCompletedAt: null
      });

      await routine.save();
      logger.info('Routine created:', { routineId: routine._id, userId });
      return routine;
    } catch (error) {
      logger.error('Failed to create routine:', error.message);
      throw error;
    }
  }

  /**
   * Get user routines
   */
  static async getUserRoutines(userId) {
    try {
      return await Routine.find({ userId, active: true });
    } catch (error) {
      logger.error('Failed to get user routines:', error.message);
      throw error;
    }
  }

  /**
   * Update routine
   */
  static async updateRoutine(routineId, data) {
    try {
      const routine = await Routine.findByIdAndUpdate(
        routineId,
        data,
        { new: true }
      );

      logger.info('Routine updated:', { routineId });
      return routine;
    } catch (error) {
      logger.error('Failed to update routine:', error.message);
      throw error;
    }
  }

  /**
   * Delete routine
   */
  static async deleteRoutine(routineId) {
    try {
      await Routine.findByIdAndUpdate(
        routineId,
        { active: false }
      );

      logger.info('Routine deleted:', { routineId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete routine:', error.message);
      throw error;
    }
  }

  /**
   * Update routine streak
   */
  static async updateStreak(routineId) {
    try {
      const routine = await Routine.findById(routineId);
      if (!routine) return null;

      const now = new Date();
      const lastCompleted = routine.lastCompletedAt ? new Date(routine.lastCompletedAt) : null;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastCompleted) {
        lastCompleted.setHours(0,0,0,0);
        
        if (lastCompleted.getTime() === today.getTime()) {
          // Already logged today, skip
          return routine;
        }
        
        if (lastCompleted.getTime() === yesterday.getTime()) {
          // Consecutive day!
          routine.streak += 1;
        } else {
          // Gap detected, reset to 1
          routine.streak = 1;
        }
      } else {
        // First time
        routine.streak = 1;
      }

      routine.lastCompletedAt = now;
      await routine.save();
      
      logger.info('Streak updated:', { routineId, newStreak: routine.streak });
      return routine;
    } catch (error) {
      logger.error('Failed to update streak:', error.message);
      throw error;
    }
  }

  /**
   * Reset streak
   */
  static async resetStreak(routineId) {
    try {
       await Routine.findByIdAndUpdate(routineId, { streak: 0 });
       logger.info('Streak reset:', { routineId });
    } catch (error) {
       logger.error('Failed to reset streak:', error.message);
    }
  }

  /**
   * Get routines due at specific time
   */
  static async getRoutinesDue(hour, minute) {
    try {
      return await Routine.find({
        active: true,
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      }).populate('userId');
    } catch (error) {
      logger.error('Failed to get routines due:', error.message);
      throw error;
    }
  }
}

export default RoutineService;
