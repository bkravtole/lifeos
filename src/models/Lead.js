import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
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
    position: String,
    
    // Lead info
    source: String, // Where the lead came from
    industry: String,
    budget: Number,
    currency: { type: String, default: 'INR' },
    
    // Lead status / funnel
    status: {
      type: String,
      enum: ['new', 'interested', 'quoted', 'negotiating', 'won', 'lost'],
      default: 'new'
    },
    stage: {
      type: String,
      enum: ['awareness', 'consideration', 'decision', 'closed'],
      default: 'awareness'
    },
    probability: { type: Number, default: 0 }, // 0-100%
    
    // Timeline
    expectedClosureDate: Date,
    lastContactAt: Date,
    nextFollowUpAt: Date,
    
    // Details
    projectDescription: String,
    requirements: String,
    notes: String,
    
    // Converted to client?
    convertedToClient: Boolean,
    convertedClientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    
    metadata: {
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

export default mongoose.model('Lead', leadSchema);
