import { WorkflowBuilder } from '../services/WorkflowEngine.js';
import ReminderService from '../services/ReminderService.js';
import logger from '../utils/logger.js';

/**
 * Example Workflows
 * Pre-built workflows for common use cases
 */

/**
 * Onboarding Workflow
 * Collects user preferences and creates initial routines
 */
export const createOnboardingWorkflow = () => {
  return new WorkflowBuilder('onboarding-v1', 'User Onboarding')
    .setStart('greeting')
    .addAskNode('greeting', 'नमस्ते! LifeOS में स्वागत है। आपका नाम क्या है?')
    .addProcessNode('name_processor', (input) => {
      return { userName: input };
    })
    .addAskNode('routines', 'आप कौन से रोज़ के काम करना चाहते हैं? (जैसे: exercise, reading, meditation)')
    .addProcessNode('routines_processor', async (input) => {
      const activities = input.split(',').map(a => a.trim());
      return { activities };
    })
    .addAskNode('morning_time', 'सुबह कितने बजे शुरुआत करते हैं?')
    .addActionNode('save_preferences', async (input) => {
      logger.info('Saving user preferences:', input);
      return { success: true, preferences: input };
    })
    .connect('greeting', 'name_processor')
    .connect('name_processor', 'routines')
    .connect('routines', 'routines_processor')
    .connect('routines_processor', 'morning_time')
    .connect('morning_time', 'save_preferences')
    .build();
};

/**
 * Reminder Creation Workflow
 * Guides user through reminder creation
 */
export const createReminderWorkflow = () => {
  return new WorkflowBuilder('reminder-creation', 'Create Reminder')
    .setStart('activity_ask')
    .addAskNode('activity_ask', 'क्या करना है? (activity)')
    .addAskNode('time_ask', 'कब याद दिलाना है? (time)')
    .addProcessNode('time_parser', (input) => {
      // Parse time input to datetime
      return { datetime: new Date(input) };
    })
    .addAskNode('repeat_ask', 'क्या यह दोहराना चाहते हैं?', [
      { label: 'रोज़', value: 'daily' },
      { label: 'साप्ताहिक', value: 'weekly' },
      { label: 'एक बार', value: 'none' }
    ])
    .addActionNode('create_reminder', async (input) => {
      // Create reminder in database
      // const reminder = await ReminderService.createReminder(userId, {
      //   activity: input.activity,
      //   datetime: input.datetime,
      //   repeat: input.repeat
      // });
      return { success: true, reminderId: 'reminder_123' };
    })
    .connect('activity_ask', 'time_ask')
    .connect('time_ask', 'time_parser')
    .connect('time_parser', 'repeat_ask')
    .connect('repeat_ask', 'create_reminder')
    .build();
};

/**
 * Activity Logging Workflow
 * Logs activity completion with stats
 */
export const createActivityWorkflow = () => {
  return new WorkflowBuilder('log-activity', 'Log Activity')
    .setStart('activity_done')
    .addAskNode(
      'activity_done',
      'क्या आपने अपना काम पूरा कर लिया?',
      [
        { label: '✅ हाँ', value: 'done' },
        { label: '⏭️ छोड़ दिया', value: 'skipped' }
      ]
    )
    .addAskNode('duration', 'कितने समय में पूरा हुआ? (मिनटों में)')
    .addActionNode('log_activity', async (input) => {
      // Log activity
      return { success: true, stats: { done: 5, streak: 3 } };
    })
    .addAskNode(
      'motivation',
      '🎉 शानदार! आप की streak 3 दिन की हो गई! क्या आप कल भी करेंगे?'
    )
    .connect('activity_done', 'duration')
    .connect('duration', 'log_activity')
    .connect('log_activity', 'motivation')
    .build();
};

export default {
  createOnboardingWorkflow,
  createReminderWorkflow,
  createActivityWorkflow
};
