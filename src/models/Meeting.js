import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema(
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
    
    title: String,
    description: String,
    
    // Schedule
    startTime: Date,
    endTime: Date,
    duration: Number, // in minutes
    
    // Location/Meeting type
    type: {
      type: String,
      enum: ['in-person', 'video-call', 'phone-call', 'other'],
      default: 'in-person'
    },
    location: String,
    meetingLink: String,
    
    // Attendees
    attendees: [{
      name: String,
      email: String,
      phone: String,
      role: String
    }],
    
    // Status
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'rescheduled'],
      default: 'scheduled'
    },
    
    // Notes
    agenda: String,
    notes: String,
    outcomes: String,
    
    // Follow-up
    followUpRequired: Boolean,
    followUpDate: Date,
    followUpNotes: String,
    
    metadata: {
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

export default mongoose.model('Meeting', meetingSchema);
