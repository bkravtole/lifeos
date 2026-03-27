import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: String,
    email: String,
    phone: String,
    company: String,
    industry: String,
    address: String,
    
    // Relationship info
    status: {
      type: String,
      enum: ['prospect', 'active', 'inactive', 'archived'],
      default: 'prospect'
    },
    source: String, // How they found you
    
    // Financial
    totalSpent: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    
    // Notes
    notes: String,
    preferences: String,
    
    // Last interaction
    lastInteractionAt: Date,
    nextFollowUpAt: Date,
    
    metadata: {
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

export default mongoose.model('Client', clientSchema);
