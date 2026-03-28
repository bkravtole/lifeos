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
    // Bug 7 Fix: Compute "today" in Kolkata time (UTC+5:30), not raw server local time
    const nowUtc = new Date();
    let kYear = nowUtc.getUTCFullYear();
    let kMonth = nowUtc.getUTCMonth() + 1; // 1-based
    let kDay = nowUtc.getUTCDate();
    let kHours = nowUtc.getUTCHours() + 5;
    let kMinutes = nowUtc.getUTCMinutes() + 30;
    if (kMinutes >= 60) { kHours += 1; kMinutes -= 60; }
    if (kHours >= 24) {
      kHours -= 24;
      kDay += 1;
      const daysInKMonth = new Date(Date.UTC(kYear, kMonth, 0)).getUTCDate();
      if (kDay > daysInKMonth) { kDay = 1; kMonth += 1; }
      if (kMonth > 12) { kMonth = 1; kYear += 1; }
    }

    let year = kYear;
    let month = kMonth;
    let day = kDay;
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
      } else {
        // PM INFERENCE (Bug Fix)
        // If no AM/PM provided, and the implied AM time is in the past for today, assume PM
        // e.g., If it is 15:40 and user says "3:41", assume 15:41 (PM) instead of 03:41 (AM)
        const isToday = !lowerStr.includes('tomorrow') && !lowerStr.includes('कल') && !lowerStr.includes('agle din');
        if (isToday && hour > 0 && hour <= 12) {
          // Calculate total minutes for comparison
          const currentTotalMinutes = kHours * 60 + kMinutes;
          const parsedTotalMinutes = hour * 60 + minute;
          
          // If the AM time has already passed today, assume PM
          if (parsedTotalMinutes <= currentTotalMinutes) {
            hour += 12;
            console.log('🔄 Inferred PM since AM time has passed:', { originalHour: hour - 12, newHour: hour });
          }
        }
      }

      // Validate hour/minute
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        console.warn('⚠️ Time validation failed:', { hour, minute, input: timeStr });
        return null;
      }

      console.log('✅ Time extracted:', { input: timeStr, hour, minute, hasAMPM: !!ampmStr });
    }

    // If no time found, return null instead of using default 9 AM
    if (hour === null) {
      console.warn('⚠️ No time found in string, returning null:', { input: timeStr });
      return null;
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
  // Bug 2 Fix: Properly handle minute → hour → day → month → year overflow
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1; // 1-based
  let day = now.getUTCDate();
  let hours = now.getUTCHours() + 5;
  let minutes = now.getUTCMinutes() + 30;
  let seconds = now.getUTCSeconds();

  // Handle minute overflow
  if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }

  // Handle hour/day overflow (Bug 2: was previously ignored with a comment)
  if (hours >= 24) {
    hours -= 24;
    day += 1;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day > daysInMonth) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  const hourStr = String(hours).padStart(2, '0');
  const minuteStr = String(minutes).padStart(2, '0');
  const secondStr = String(seconds).padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:${secondStr}+05:30`;
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
  // Parse reminder datetime - MUST include date!
  let reminderYear, reminderMonth, reminderDay, reminderHour, reminderMinute;
  
  if (typeof reminderDateTime === 'string') {
    // Parse ISO string like "2026-03-28T14:05:00+05:30"
    const match = reminderDateTime.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return false;
    
    const [, year, month, day, hour, minute] = match;
    reminderYear = parseInt(year);
    reminderMonth = parseInt(month);
    reminderDay = parseInt(day);
    reminderHour = parseInt(hour);
    reminderMinute = parseInt(minute);
  } else if (reminderDateTime instanceof Date) {
    reminderYear = reminderDateTime.getFullYear();
    reminderMonth = reminderDateTime.getMonth() + 1;
    reminderDay = reminderDateTime.getDate();
    reminderHour = reminderDateTime.getHours();
    reminderMinute = reminderDateTime.getMinutes();
  } else {
    return false;
  }
  
  // Bug 3 Fix: Get current Kolkata time (UTC + 5:30) with proper date computation
  const nowUtc = new Date();
  let kolkataHours = nowUtc.getUTCHours() + 5;
  let kolkataMinutes = nowUtc.getUTCMinutes() + 30;

  // Handle minute overflow
  if (kolkataMinutes >= 60) {
    kolkataHours += 1;
    kolkataMinutes -= 60;
  }

  // Determine today's date in Kolkata (ADD 5:30 to UTC, use UTC getters)
  let currentYear = nowUtc.getUTCFullYear();
  let currentMonth = nowUtc.getUTCMonth() + 1; // 1-based
  let currentDay = nowUtc.getUTCDate();

  // If adding 5:30 hours caused a day rollover
  if (kolkataHours >= 24) {
    kolkataHours -= 24;
    currentDay += 1;
    const daysInCurrentMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
    if (currentDay > daysInCurrentMonth) {
      currentDay = 1;
      currentMonth += 1;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear += 1;
      }
    }
  }
  
  console.log('⏰ Reminder time check (with DATE):', {
    reminderDate: `${reminderYear}-${String(reminderMonth).padStart(2, '0')}-${String(reminderDay).padStart(2, '0')}`,
    reminderTime: `${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}`,
    currentDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`,
    kolkataTime: `${String(kolkataHours).padStart(2, '0')}:${String(kolkataMinutes).padStart(2, '0')}`
  });
  
  // For one-time reminders: MUST match exact date AND time must have passed
  // Check if dates match (year, month, day)
  const dateMatch = reminderYear === currentYear && reminderMonth === currentMonth && reminderDay === currentDay;
  
  // Check if time has passed (current time >= reminder time)
  const reminderTotalMinutes = reminderHour * 60 + reminderMinute;
  const kolkataTotalMinutes = kolkataHours * 60 + kolkataMinutes;
  const timeMatch = kolkataTotalMinutes >= reminderTotalMinutes;
  
  // Trigger ONLY if:
  // 1. Date matches today
  // 2. Time has passed
  const isDue = dateMatch && timeMatch;
  
  if (isDue) {
    console.log('✅ REMINDER IS DUE! (Date & Time both match)');
  } else if (!dateMatch) {
    console.log('⏳ Reminder not due: Date mismatch (reminder date is future/past)');
  } else if (!timeMatch) {
    console.log('⏳ Reminder not due: Time not reached yet');
  }
  
  return isDue;
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
  let kolkataHours = nowUtc.getUTCHours() + 5;
  let kolkataMinutes = nowUtc.getUTCMinutes() + 30;
  
  // Handle minute overflow
  if (kolkataMinutes >= 60) {
    kolkataHours += 1;
    kolkataMinutes -= 60;
  }
  
  // Handle hour overflow
  kolkataHours = kolkataHours % 24;
  
  const currentTotalMinutes = (kolkataHours * 60) + kolkataMinutes;
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
