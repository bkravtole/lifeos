import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
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
    
    invoiceNumber: String,
    invoiceDate: Date,
    dueDate: Date,
    
    amount: Number,
    currency: { type: String, default: 'INR' },
    tax: { type: Number, default: 0 },
    totalAmount: Number,
    
    description: String,
    items: [{
      description: String,
      quantity: Number,
      rate: Number,
      amount: Number
    }],
    
    // Payment tracking
    status: {
      type: String,
      enum: ['draft', 'sent', 'overdue', 'paid', 'cancelled'],
      default: 'draft'
    },
    paidAmount: { type: Number, default: 0 },
    paymentDate: Date,
    paymentMethod: String,
    
    // Notes
    notes: String,
    
    metadata: {
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

export default mongoose.model('Invoice', invoiceSchema);
