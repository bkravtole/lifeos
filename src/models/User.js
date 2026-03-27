import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: String,
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    preferences: {
      language: { type: String, default: 'hi' },
      notificationsEnabled: { type: Boolean, default: true }
    },
    metadata: {
      lastMessageAt: Date,
      totalMessages: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
