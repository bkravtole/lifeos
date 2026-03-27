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
    email: String,
    
    // Onboarding
    onboardingCompleted: {
      type: Boolean,
      default: false
    },
    onboardingStep: {
      type: Number,
      default: 0
    },

    // User Type
    userType: {
      type: String,
      enum: ['personal', 'business'],
      default: 'personal'
    },

    // Language preference (detected from first message)
    preferredLanguage: {
      type: String,
      enum: ['english', 'hindi', 'hinglish'],
      default: 'english'
    },

    // User Profile Info (Personal)
    dailyActivities: [String], // e.g., ["gym", "meditation", "work"]
    hobbies: [String], // e.g., ["reading", "coding", "sports"]
    workSchedule: {
      startTime: String, // e.g., "09:00"
      endTime: String, // e.g., "18:00"
      workDays: [String] // e.g., ["Monday", "Tuesday", ...]
    },
    reminderPreferences: {
      enableReminders: { type: Boolean, default: true },
      reminderTime: String, // e.g., "09:00"
      reminderFrequency: String // "daily", "weekly", "custom"
    },

    // Business Profile Info
    businessProfile: {
      businessName: String,
      businessType: String, // e.g., "Consulting", "E-commerce", "Service", etc.
      businessDescription: String,
      businessEmail: String,
      businessPhone: String,
      businessWebsite: String,
      businessAddress: String,
      
      // Business Operations
      businessHours: {
        startTime: String,
        endTime: String,
        workDays: [String]
      },
      
      // Revenue/Sales Tracking
      monthlyTarget: Number, // Monthly revenue target
      currency: String, // e.g., "INR", "USD"
      
      // Team Info
      teamMembers: [String], // Team member emails
      numberOfEmployees: Number,
      
      // Services/Products offered
      services: [String], // e.g., ["Consulting", "Development", "Design"]
      products: [String],
      
      // Business contacts enabled
      enableClientTracking: { type: Boolean, default: true },
      enableInvoiceTracking: { type: Boolean, default: true },
      enableMeetingScheduling: { type: Boolean, default: true },
      enableLeadTracking: { type: Boolean, default: true }
    },

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
