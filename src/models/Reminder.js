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
        // Default to current Kolkata time
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours() + 5).padStart(2, '0');
        const minutes = String((now.getUTCMinutes() + 30) % 60).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
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
