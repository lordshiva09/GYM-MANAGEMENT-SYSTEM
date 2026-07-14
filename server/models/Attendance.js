const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  memberId: { type: String, required: true },
  memberName: { type: String, required: true },
  date: { type: String, required: true },
  checkInTime: { type: String, required: true },
  timestamp: { type: Number, required: true },
  method: { type: String, default: 'manual', enum: ['fingerprint', 'webauthn', 'manual', 'demo'] },
  deviceUserId: { type: Number },
  synced: { type: Boolean, default: true }
}, { timestamps: true });

attendanceSchema.index({ memberId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
