import logger from '../utils/logger.js';

/**
 * Intent Router
 * Routes AI output to appropriate service module
 */
export class IntentRouter {
  static async route(intent, entities, handlers) {
    try {
      switch (intent) {
        case 'CREATE_REMINDER':
          return await handlers.reminderService?.createReminder(entities);

        case 'UPDATE_REMINDER':
          return await handlers.reminderService?.updateReminder(entities);

        case 'DELETE_REMINDER':
          return await handlers.reminderService?.deleteReminder(entities);

        case 'LOG_ACTIVITY':
          return await handlers.activityService?.logActivity(entities);

        case 'CREATE_ROUTINE':
          return await handlers.routineService?.createRoutine(entities);

        case 'UPDATE_ROUTINE':
          return await handlers.routineService?.updateRoutine(entities);
          
        case 'DELETE_ROUTINE':
          return await handlers.routineService?.deleteRoutine(entities);

        case 'QUERY_ROUTINE':
          return await handlers.routineService?.queryRoutine(entities);

        case 'UPDATE_NAME':
          return await handlers.userService?.updateName(entities);

        case 'QUERY_REMINDERS':
          return await handlers.userService?.queryReminders(entities);

        case 'CREATE_GOAL':
          return await handlers.goalService?.createGoal(entities);

        case 'QUERY_GOALS':
          return await handlers.goalService?.queryGoals(entities);

        case 'CHAT':
          return await handlers.chatService?.chat(entities);

        default:
          logger.warn('Unknown intent:', intent);
          return { success: false, message: 'Intent not recognized' };
      }
    } catch (error) {
      logger.error('Intent routing failed:', error.message);
      throw error;
    }
  }

  /**
   * Get priority of intent (for processing order)
   */
  static getPriority(intent) {
    const priorityMap = {
      'CREATE_REMINDER': 1,
      'UPDATE_NAME': 2,
      'DELETE_REMINDER': 2,
      'LOG_ACTIVITY': 3,
      'UPDATE_ROUTINE': 4,
      'DELETE_ROUTINE': 4,
      'CREATE_GOAL': 3,
      'QUERY_GOALS': 5,
      'CHAT': 5,
      'QUERY_ROUTINE': 6
    };
    return priorityMap[intent] || 99;
  }
}

export default IntentRouter;
