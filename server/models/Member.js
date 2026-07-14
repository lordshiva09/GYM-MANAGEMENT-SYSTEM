const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  memberId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  plan: { type: String, default: 'Premium' },
  timing: { type: String, default: 'Morning (6AM - 9AM)' },
  status: { type: String, default: 'Active' },
  joinDate: { type: String },
  expiryDate: { type: String },
  password: { type: String, select: false },
  role: { type: String, default: 'member', enum: ['admin', 'staff', 'member'] },
  biometricId: { type: Number, unique: true, sparse: true },
  fingerprintEnrolled: { type: Boolean, default: false },
  fingerprintEnrolledAt: { type: String },
  webAuthnCredentials: [{
    credentialId: { type: String, required: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    deviceType: { type: String },
    backedUp: { type: Boolean, default: false },
    transports: [String],
    enrolledAt: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Member', memberSchema);
