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
      type: Date,
      required: true,
      index: true
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
