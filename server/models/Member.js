const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  memberId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  plan: { type: String, default: 'Premium' },
  timing: { type: String, default: 'Morning (6AM - 9AM)' },
  status: { type: String, default: 'Active' },
  joinDate: { type: String },
  expiryDate: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Member', memberSchema);
