const mongoose = require('mongoose');

const backupLogSchema = new mongoose.Schema({
  backupId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['daily', 'incremental', 'manual'], default: 'daily' },
  uncompressedSize: { type: Number, default: 0 },
  compressedSize: { type: Number, default: 0 },
  status: { type: String, enum: ['success', 'failed', 'partial'], default: 'success' },
  steps: {
    mongodump: { status: String, duration: String },
    compress: { status: String, duration: String },
    localStore: { status: String, path: String },
    googleDrive: { status: String, path: String },
    cleanup: { status: String, deleted: Number }
  },
  collections: {
    members: { count: Number, size: Number },
    attendance: { count: Number, size: Number },
    payments: { count: Number, size: Number },
    settings: { count: Number, size: Number }
  },
  localPath: String,
  error: String
}, { timestamps: true });

module.exports = mongoose.model('BackupLog', backupLogSchema);
