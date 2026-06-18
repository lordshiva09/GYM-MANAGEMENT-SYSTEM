const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'gym_settings', unique: true },
  upiId: { type: String, default: 'rsmultinationalgym@upi' },
  gymName: { type: String, default: 'RS MULTI GYM ( UNISEX GYM )' },
  gymEmail: { type: String, default: '' },
  gymPhone: { type: String, default: '' },
  gymAddress: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  zip: { type: String, default: '' },
  mapsUrl: { type: String, default: 'https://maps.app.goo.gl/CJ4c7EDz4Nm4jMom7' },
  contactPerson: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  emergencyContact: { type: String, default: '' },
  website: { type: String, default: '' },
  whatsappNumber: { type: String, default: '9341862473' },
  waEnabled: { type: Boolean, default: true },
  smtpServer: { type: String, default: '' },
  smtpPort: { type: String, default: '' },
  smtpEncryption: { type: String, default: 'TLS' },
  senderEmail: { type: String, default: '' },
  emailEnabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
