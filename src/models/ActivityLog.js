import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['done', 'skipped', 'missed'],
      required: true
    },
    date: {
      type: Date,
      default: Date.now,
      index: true
    },
    duration: Number,
    notes: String
  },
  { timestamps: true }
);

export default mongoose.model('ActivityLog', activityLogSchema);
