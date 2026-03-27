import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    
    name: String,
    description: String,
    
    // Budget & Billing
    budget: Number,
    billableHours: Number,
    hourlyRate: Number,
    currency: { type: String, default: 'INR' },
    
    // Timeline
    startDate: Date,
    endDate: Date,
    estimatedHours: Number,
    actualHours: { type: Number, default: 0 },
    
    // Status
    status: {
      type: String,
      enum: ['planning', 'in-progress', 'on-hold', 'completed', 'cancelled'],
      default: 'planning'
    },
    progress: { type: Number, default: 0 }, // 0-100%
    
    // Team
    assignedTo: [String], // Team member emails
    
    // Tasks
    tasks: [{
      title: String,
      description: String,
      status: String,
      assignee: String,
      dueDate: Date,
      completed: Boolean
    }],
    
    // Communication
    notes: String,
    deliverables: [String],
    
    metadata: {
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
