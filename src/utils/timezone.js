const TIMEZONE = 'Asia/Kolkata';

/**
 * Parse time string in Asia/Kolkata timezone
 * DIRECT STORAGE: No UTC conversion! Store times exactly as user specifies.
 * Returns ISO string with +05:30 offset to represent Kolkata time explicitly.
 * 
 * Handles: "14:30", "2:30 PM", "11:06 AM", "tomorrow 9 AM", "9 AM today", etc.
 * 
 * @param {string} timeStr - Time input string
 * @returns {string|null} - ISO datetime with +05:30 offset (e.g., "2026-03-28T11:22:00+05:30") or null if invalid
 */
export function parseTimeInKolkata(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  try {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let hour = null;
    let minute = 0;
    
    const lowerStr = timeStr.toLowerCase().trim();

    // More robust time extraction - handles multiple formats
    // "14:30", "14 30", "2:30", "00:15", "11:06", "2:30 PM", "11 52 am", etc.
    let timeMatch = lowerStr.match(/(\d{1,2})\s*[:./\s]\s*(\d{2})\s*(am|pm|a\.m|p\.m)?/i);
    
    // If first pattern didn't work, try just hour only
    if (!timeMatch) {
      timeMatch = lowerStr.match(/(\d{1,2})\s*(am|pm|a\.m|p\.m)?/i);
    }
    
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] && timeMatch[2].match(/^\d/) ? parseInt(timeMatch[2]) : 0;
      
      // Get AM/PM indicator (it could be in different positions)
      const ampmStr = lowerStr.match(/(am|pm|a\.m|p\.m)/i)?.[0] || '';

      // Handle AM/PM conversion
      if (ampmStr) {
        const ampm = ampmStr.toLowerCase().replace('.', '');
        if (ampm === 'pm' && hour < 12) {
          hour += 12;
        }
        if (ampm === 'am' && hour === 12) {
          hour = 0;
        }
      }

      // Validate hour/minute
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        console.warn('⚠️ Time validation failed:', { hour, minute, input: timeStr });
        return null;
      }

      console.log('✅ Time extracted:', { input: timeStr, hour, minute, hasAMPM: !!ampmStr });
    }

    // If no time found, use default 9 AM (but log this!)
    if (hour === null) {
      console.warn('⚠️ No time found in string, using default 9 AM:', { input: timeStr });
      hour = 9;
      minute = 0;
    }

    // Determine target date
    if (lowerStr.includes('tomorrow') || lowerStr.includes('कल') || lowerStr.includes('agle din')) {
      day = day + 1;
      // Handle month/year overflow
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day > daysInMonth) {
        day = 1;
        month = month + 1;
        if (month > 12) {
          month = 1;
          year = year + 1;
        }
      }
    }
    // For "today" or no date mentioned, use today (already set)

    // Format as ISO string with +05:30 offset (Kolkata timezone)
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    const minuteStr = String(minute).padStart(2, '0');
    
    const result = `${year}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00+05:30`;
    console.log('✅ Final parsed time:', { input: timeStr, output: result });
    
    // Store with +05:30 offset to indicate Kolkata time (NO UTC conversion)
    return result;
  } catch (error) {
    console.error('❌ Error parsing time in Kolkata timezone:', error.message);
    return null;
  }
}

/**
 * Get current time in Asia/Kolkata (as ISO string with +05:30 offset)
 * @returns {string} - ISO string with Kolkata offset
 */
export function getCurrentTimeInKolkata() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours() + 5).padStart(2, '0'); // UTC + 5:30 hours
  const minutes = String(now.getUTCMinutes() + 30).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  
  // Handle minute overflow
  if (now.getUTCMinutes() + 30 >= 60) {
    return `${year}-${month}-${day}T${hours}:${String((now.getUTCMinutes() + 30) % 60).padStart(2, '0')}:${seconds}+05:30`;
  }
  
  return `${year}-${month}-${day}T${String(now.getUTCHours() + 5).padStart(2, '0')}:${String(now.getUTCMinutes() + 30).padStart(2, '0')}:${seconds}+05:30`;
}

/**
 * Format a date for display in Kolkata timezone
 * @param {Date|string} date - Date to format or ISO string with +05:30 offset
 * @param {string} formatStr - Format pattern ('HH:mm:ss', 'yyyy-MM-dd HH:mm:ss', etc)
 * @returns {string} - Formatted time
 */
export function formatTimeInKolkata(date, formatStr = 'yyyy-MM-dd HH:mm:ss') {
  let year, month, day, hours, minutes, seconds;
  
  if (typeof date === 'string') {
    // Parse ISO string with +05:30 (e.g., "2026-03-28T11:22:00+05:30")
    const match = date.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      [, year, month, day, hours, minutes, seconds] = match;
    } else {
      // Try to parse as Date
      const d = new Date(date);
      year = d.getFullYear();
      month = String(d.getMonth() + 1).padStart(2, '0');
      day = String(d.getDate()).padStart(2, '0');
      hours = String(d.getHours()).padStart(2, '0');
      minutes = String(d.getMinutes()).padStart(2, '0');
      seconds = String(d.getSeconds()).padStart(2, '0');
    }
  } else if (date instanceof Date) {
    year = date.getFullYear();
    month = String(date.getMonth() + 1).padStart(2, '0');
    day = String(date.getDate()).padStart(2, '0');
    hours = String(date.getHours()).padStart(2, '0');
    minutes = String(date.getMinutes()).padStart(2, '0');
    seconds = String(date.getSeconds()).padStart(2, '0');
  }
  
  return formatStr
    .replace('yyyy', year)
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Check if a reminder should be sent
 * Triggers when within ±2 minutes of reminder time
 * @param {string|Date} reminderDateTime - Reminder time (ISO string with +05:30 or Date object)
 * @returns {boolean} - Whether to send the reminder
 */
export function isReminderDue(reminderDateTime) {
  // Parse reminder datetime
  let reminderHour, reminderMinute, reminderDate;
  
  if (typeof reminderDateTime === 'string') {
    // Parse ISO string like "2026-03-28T11:22:00+05:30"
    const match = reminderDateTime.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return false;
    
    const [, year, month, day, hour, minute] = match;
    reminderDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 
                                      parseInt(hour), parseInt(minute), 0));
    reminderHour = parseInt(hour);
    reminderMinute = parseInt(minute);
  } else if (reminderDateTime instanceof Date) {
    reminderHour = reminderDateTime.getHours();
    reminderMinute = reminderDateTime.getMinutes();
    reminderDate = reminderDateTime;
  } else {
    return false;
  }
  
  // Get current Kolkata time
  const nowUtc = new Date();
  const kolkataHours = nowUtc.getUTCHours() + 5;
  const kolkataMinutes = (nowUtc.getUTCMinutes() + 30) % 60;
  
  // Compare hours and minutes (within ±2 minutes window)
  const hourMatch = reminderHour === Math.floor(kolkataHours % 24);
  const minuteDiff = Math.abs(reminderMinute - kolkataMinutes);
  const minuteMatch = minuteDiff <= 2 || (minuteDiff === 58); // Handle minute wrap-around
  
  return hourMatch && minuteMatch;
}

/**
 * Get time remaining until reminder
 * @param {string|Date} reminderDateTime - Reminder time (ISO string or Date)
 * @returns {string} - Human readable time difference
 */
export function getTimeRemaining(reminderDateTime) {
  let reminderHour, reminderMinute;
  
  if (typeof reminderDateTime === 'string') {
    const match = reminderDateTime.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      reminderHour = parseInt(match[1]);
      reminderMinute = parseInt(match[2]);
    } else {
      return 'Invalid time';
    }
  } else if (reminderDateTime instanceof Date) {
    reminderHour = reminderDateTime.getHours();
    reminderMinute = reminderDateTime.getMinutes();
  } else {
    return 'Invalid time';
  }
  
  const nowUtc = new Date();
  const kolkataHours = nowUtc.getUTCHours() + 5;
  const kolkataMinutes = (nowUtc.getUTCMinutes() + 30) % 60;
  
  const currentTotalMinutes = (Math.floor(kolkataHours % 24) * 60) + kolkataMinutes;
  const reminderTotalMinutes = (reminderHour * 60) + reminderMinute;
  const diffMinutes = reminderTotalMinutes - currentTotalMinutes;
  
  if (diffMinutes < -2) {
    return `${Math.abs(diffMinutes)} minutes ago`;
  } else if (diffMinutes > 2) {
    return `${diffMinutes} minutes remaining`;
  } else {
    return 'NOW!';
  }
}

/**
 * Legacy compatibility functions (for existing code)
 */
export function toKolkataTime(date) {
  return date; // No conversion needed - already in Kolkata time
}

export function toUTC(date) {
  return date; // No conversion needed - already in Kolkata time
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
