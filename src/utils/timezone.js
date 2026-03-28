import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parse } from 'date-fns';

const TIMEZONE = 'Asia/Kolkata';

/**
 * Get current time in Asia/Kolkata timezone
 * @returns {Date} - Current UTC Date (but representing Kolkata time)
 */
export function getCurrentTimeInKolkata() {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Convert UTC date to Asia/Kolkata timezone
 * @param {Date} utcDate - UTC date
 * @returns {Date} - Kolkata time
 */
export function toKolkataTime(utcDate) {
  return toZonedTime(utcDate, TIMEZONE);
}

/**
 * Convert Kolkata local time to UTC for storage
 * @param {Date} kolkataTime - Kolkata local time
 * @returns {Date} - UTC date for storage
 */
export function toUTC(kolkataTime) {
  return fromZonedTime(kolkataTime, TIMEZONE);
}

/**
 * Parse time string in Asia/Kolkata timezone
 * Handles: "14:30", "2:30 PM", "00:15 AM", "tomorrow 9 AM", "9 AM today", etc.
 * 
 * @param {string} timeStr - Time input string
 * @returns {Date|null} - Parsed datetime in UTC (for storage) or null if invalid
 */
export function parseTimeInKolkata(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  try {
    const now = getCurrentTimeInKolkata();
    let targetDate = new Date(now);
    let hour = null;
    let minute = 0;
    
    const lowerStr = timeStr.toLowerCase().trim();

    // Extract time (handles "14:30", "14 30", "2:30", "00:15", etc)
    const timeMatch = lowerStr.match(/(\d{1,2})\s*[:./]?\s*(\d{2})?\s*(am|pm|a\.m|p\.m)?/i);
    
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

      // Handle AM/PM conversion
      if (timeMatch[3]) {
        const ampm = timeMatch[3].toLowerCase().replace('.', '');
        if (ampm === 'pm' && hour < 12) {
          hour += 12;
        }
        if (ampm === 'am' && hour === 12) {
          hour = 0;
        }
      }

      // Validate hour/minute
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
      }
    }

    // If no time found, use default
    if (hour === null) {
      hour = 9;
      minute = 0;
    }

    // Determine target date
    if (lowerStr.includes('tomorrow') || lowerStr.includes('कल') || lowerStr.includes('agle din')) {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(hour, minute, 0, 0);
    } else if (lowerStr.includes('today') || lowerStr.includes('आज') || lowerStr.includes('aaj')) {
      // Today - set the time for today in Kolkata
      targetDate.setHours(hour, minute, 0, 0);
    } else {
      // No date specified, assume today
      targetDate.setHours(hour, minute, 0, 0);
    }

    // Convert Kolkata local time to UTC for storage
    const utcTime = toUTC(targetDate);
    
    return utcTime;
  } catch (error) {
    console.error('Error parsing time in Kolkata timezone:', error.message);
    return null;
  }
}

/**
 * Format a UTC date for display in Asia/Kolkata timezone
 * @param {Date} utcDate - UTC date from database
 * @param {string} formatStr - Format string (default: 'yyyy-MM-dd HH:mm:ss')
 * @returns {string} - Formatted time in Kolkata timezone
 */
export function formatTimeInKolkata(utcDate, formatStr = 'yyyy-MM-dd HH:mm:ss') {
  return formatInTimeZone(utcDate, TIMEZONE, formatStr);
}

/**
 * Check if a reminder should be sent based on Kolkata time
 * More lenient: triggers 2 minutes before to 1 minute after reminder time
 * 
 * @param {Date} reminderDateTime - UTC reminder datetime from database
 * @returns {boolean} - Whether to send the reminder
 */
export function isReminderDue(reminderDateTime) {
  const nowUTC = new Date();
  
  // Calculate difference in minutes
  const diffInMs = nowUTC - reminderDateTime;
  const diffInMinutes = diffInMs / 60000;
  
  // Send if within range: 2 minutes before to 1 minute after
  return diffInMinutes >= -2 && diffInMinutes <= 1;
}

/**
 * Get time difference for logging
 * @param {Date} reminderDateTime - UTC reminder datetime
 * @returns {string} - Human readable time difference
 */
export function getTimeRemaining(reminderDateTime) {
  const nowUTC = new Date();
  const diffInMs = reminderDateTime - nowUTC;
  
  if (diffInMs < 0) {
    const minutesPassed = Math.abs(diffInMs / 60000);
    return `${minutesPassed.toFixed(0)} minutes ago`;
  } else {
    const minutesRemaining = diffInMs / 60000;
    return `${minutesRemaining.toFixed(0)} minutes remaining`;
  }
}

export default {
  TIMEZONE,
  getCurrentTimeInKolkata,
  toKolkataTime,
  toUTC,
  parseTimeInKolkata,
  formatTimeInKolkata,
  isReminderDue,
  getTimeRemaining
};
