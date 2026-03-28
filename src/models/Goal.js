import mongoose from 'mongoose';

const subTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['reminder', 'routine'],
    default: 'routine'
  },
  time: String,           // e.g., "7:00 AM"
  schedule: {
    type: String,
    enum: ['once', 'daily', 'weekly'],
    default: 'daily'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'skipped'],
    default: 'pending'
  },
  linkedReminderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reminder'
  },
  linkedRoutineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Routine'
  }
});

const goalSchema = new mongoose.Schema(
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
    deadline: Date,
    subTasks: [subTaskSchema],
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active'
    },
    category: String  // e.g., 'fitness', 'study', 'work'
  },
  { timestamps: true }
);

export default mongoose.model('Goal', goalSchema);
