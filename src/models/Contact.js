import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    // Lowercase name for easy searching
    nameLower: {
      type: String,
      index: true
    },
    phone: {
      type: String,
      required: true
    },
    // Aliases/nicknames for this contact (e.g. "bhai", "mom", "boss")
    aliases: [String],
    relationship: {
      type: String,
      default: 'other' // friend, family, colleague, client, other
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Auto-fill nameLower before save
contactSchema.pre('save', function (next) {
  this.nameLower = this.name.toLowerCase();
  next();
});

// Compound index for efficient lookup
contactSchema.index({ userId: 1, nameLower: 1 });

export default mongoose.model('Contact', contactSchema);
