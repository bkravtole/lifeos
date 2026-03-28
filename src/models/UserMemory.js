import mongoose from 'mongoose';

const userMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['habit', 'preference', 'pattern', 'fact'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'general'  // e.g., 'fitness', 'work', 'health', 'social'
    },
    confidence: {
      type: Number,
      default: 0.3,
      min: 0,
      max: 1
    },
    source: {
      type: String,
      enum: ['routine', 'activity', 'chat', 'inferred', 'goal'],
      default: 'inferred'
    },
    reinforceCount: {
      type: Number,
      default: 1
    },
    lastReinforcedAt: {
      type: Date,
      default: Date.now
    },
    relatedActivity: String,  // e.g., "gym", "meditation"
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Compound index for efficient lookup
userMemorySchema.index({ userId: 1, type: 1, relatedActivity: 1 });

export default mongoose.model('UserMemory', userMemorySchema);
