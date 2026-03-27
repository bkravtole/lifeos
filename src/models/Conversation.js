import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    messages: [messageSchema],
    context: {
      lastActivity: String,
      missedActivities: [String],
      preferences: mongoose.Schema.Types.Mixed
    },
    summary: String
  },
  { timestamps: true }
);

export default mongoose.model('Conversation', conversationSchema);
