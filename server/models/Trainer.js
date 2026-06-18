const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  experience: { type: String, default: '' },
  photo: { type: String, default: '' },
  bio: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Trainer', trainerSchema);
