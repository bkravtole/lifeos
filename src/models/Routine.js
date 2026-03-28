import mongoose from 'mongoose';

const routineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    activity: {
      type: String,
      required: true
    },
    schedule: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      default: 'daily'
    },
    time: {
      type: String,
      required: true
    },
    daysOfWeek: [Number],
    description: String,
    active: { type: Boolean, default: true },
    streak: { type: Number, default: 0 },
    lastCompletedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model('Routine', routineSchema);
