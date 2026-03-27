/**
 * Configuration File
 * Application-wide constants and configurations
 */

export const CONFIG = {
  // Reminders
  REMINDER: {
    CHECK_INTERVAL_MINUTES: 1,
    SNOOZE_DURATION_MINUTES: 5,
    REPEAT_OPTIONS: ['none', 'daily', 'weekly', 'monthly']
  },

  // Routines
  ROUTINE: {
    CHECK_INTERVAL_MINUTES: 1,
    SCHEDULE_OPTIONS: ['daily', 'weekly', 'monthly', 'custom']
  },

  // Activities
  ACTIVITY: {
    STATUS_OPTIONS: ['done', 'skipped', 'missed'],
    HISTORY_DAYS: 30,
    STATS_CALCULATION_DAYS: 7
  },

  // Reminders & Notifications
  NOTIFICATION: {
    SLEEP_START_HOUR: 22, // 10 PM
    SLEEP_END_HOUR: 6, // 6 AM
    QUIET_HOURS_ENABLED: true
  },

  // Messages
  MESSAGES: {
    FALLBACK: 'समझ नहीं आया 😅 फिर से बताओ',
    GREETING: 'नमस्ते! मैं LifeOS हूँ। मैं आपके दैनिक काम को ट्रैक करने में मदद करूंगा। 🎯',
    REMINDER_ACK: '✅ Reminder set कर दिया!',
    ACTIVITY_LOGGED: '🎉 शानदार! Activity लॉग कर दिया।',
    ACTIVITY_SKIPPED: '👌 ठीक है। अगले दिन फिर से करेंगे।'
  },

  // AI/Groq
  AI: {
    MODEL: 'mixtral-8x7b-32768',
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1024,
    LANGUAGE: 'hi'
  },

  // Database
  DB: {
    BATCH_SIZE: 100,
    CLEANUP_DAYS: 90,
    INDEX_OPTIONS: { background: true }
  },

  // Workflow
  WORKFLOW: {
    TIMEOUT_SECONDS: 300,
    MAX_RETRIES: 3
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // Timezone
  TIMEZONE: {
    DEFAULT: 'Asia/Kolkata'
  },

  // Logging
  LOG: {
    LEVELS: ['error', 'warn', 'info', 'debug'],
    DEFAULT_LEVEL: 'info',
    MAX_FILE_SIZE: '20m',
    MAX_FILES: 5
  }
};

// Priority Levels
export const INTENT_PRIORITY = {
  CREATE_REMINDER: 1,
  DELETE_REMINDER: 2,
  UPDATE_REMINDER: 3,
  LOG_ACTIVITY: 4,
  CREATE_ROUTINE: 5,
  UPDATE_ROUTINE: 6,
  QUERY_ROUTINE: 7,
  CHAT: 8
};

// Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Event Types
export const EVENT_TYPES = {
  MESSAGE_RECEIVED: 'message.received',
  REMINDER_CREATED: 'reminder.created',
  REMINDER_SENT: 'reminder.sent',
  ACTIVITY_LOGGED: 'activity.logged',
  ROUTINE_TRIGGERED: 'routine.triggered',
  USER_ENGAGED: 'user.engaged'
};

export default CONFIG;
