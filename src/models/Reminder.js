import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    description: String,
    datetime: {
      type: String,
      required: true,
      index: true,
      default: () => {
        // Default to current Kolkata time (UTC+5:30) with proper overflow handling
        const now = new Date();
        let year = now.getUTCFullYear();
        let month = now.getUTCMonth() + 1; // 1-based
        let day = now.getUTCDate();
        let hours = now.getUTCHours() + 5;
        let minutes = now.getUTCMinutes() + 30;
        const seconds = now.getUTCSeconds();

        // Carry overflow: minutes → hours
        if (minutes >= 60) {
          hours += 1;
          minutes -= 60;
        }

        // Carry overflow: hours → day
        if (hours >= 24) {
          hours -= 24;
          day += 1;
          // Carry overflow: day → month → year
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
    },
    repeat: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'monthly'],
      default: 'none'
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'snoozed', 'cancelled'],
      default: 'active'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    notified: { type: Boolean, default: false },
    notifiedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model('Reminder', reminderSchema);
