const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  txnId: { type: String, required: true, unique: true },
  member: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, default: 'UPI' },
  plan: { type: String, default: 'Premium' },
  type: { type: String, default: 'New Registration' },
  status: { type: String, default: 'Paid' },
  date: { type: String },
  timestamp: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
