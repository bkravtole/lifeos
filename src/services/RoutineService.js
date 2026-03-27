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
        description: data.description
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
