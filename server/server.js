require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const Member = require('./models/Member');
const Payment = require('./models/Payment');
const Settings = require('./models/Settings');

const memberRoutes = require('./routes/members');
const paymentRoutes = require('./routes/payments');
const settingsRoutes = require('./routes/settings');
const trainerRoutes = require('./routes/trainers');

// ===== CONFIG =====
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const MEMBERS_FILE = path.join(__dirname, 'members.json');
const SENT_ALERTS_FILE = path.join(__dirname, 'sent-alerts.json');

// ===== WHATSAPP CLIENT =====
let sentAlerts = {};
try {
  if (fs.existsSync(SENT_ALERTS_FILE)) {
    sentAlerts = JSON.parse(fs.readFileSync(SENT_ALERTS_FILE, 'utf8'));
  }
} catch (e) { sentAlerts = {}; }

function saveSentAlerts() {
  fs.writeFileSync(SENT_ALERTS_FILE, JSON.stringify(sentAlerts, null, 2));
}

let waReady = false;
let waQR = null;
let waClient = null;

// Only initialize WhatsApp if not on Render (no display/chromium issues)
if (!process.env.RENDER && !process.env.DISABLE_WHATSAPP) {
  try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    waClient = new Client({
      authStrategy: new LocalAuth({ clientId: 'rsgym-bot' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    waClient.on('qr', (qr) => {
      waQR = qr;
      qrcode.generate(qr, { small: true });
      console.log('\n[!] SCAN THE QR CODE ABOVE WITH WHATSAPP WEB\n');
    });

    waClient.on('ready', () => {
      waReady = true;
      waQR = null;
      console.log('[+] WhatsApp client is ready!');
    });

    waClient.on('disconnected', (reason) => {
      waReady = false;
      console.log('[-] WhatsApp disconnected:', reason);
    });

    waClient.on('auth_failure', (msg) => {
      waReady = false;
      console.log('[-] Auth failure:', msg);
    });

    waClient.initialize().catch(err => {
      console.error('[-] Failed to initialize WhatsApp:', err.message);
    });
  } catch (err) {
    console.error('[-] WhatsApp not available:', err.message);
  }
} else {
  console.log('[!] WhatsApp disabled (running on Render or DISABLE_WHATSAPP set)');
}

// ===== HELPERS =====
function parseDate(dateStr) {
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const parts = dateStr.split(', ');
  if (parts.length < 2) return new Date();
  const dateParts = parts[0].split(' ');
  const month = months[dateParts[0]];
  const day = parseInt(dateParts[1]);
  const year = parseInt(parts[1]);
  if (parts[1] && parts[1].includes(':')) {
    const timeParts = parts[1].split(' ');
    if (timeParts.length > 1) {
      const hm = timeParts[1].split(':');
      const hours = parseInt(hm[0]);
      const mins = parseInt(hm[1]);
      return new Date(year, month, day, hours, mins);
    }
  }
  return new Date(year, month, day);
}

function minutesUntilExpiry(expiryDateStr) {
  const now = new Date();
  const exp = parseDate(expiryDateStr);
  return (exp - now) / (1000 * 60);
}

function formatPhone(mobile) {
  let num = mobile.replace(/\D/g, '');
  if (num.startsWith('0')) num = num.substring(1);
  if (num.length <= 10) num = '91' + num;
  return num + '@c.us';
}

async function sendWhatsApp(mobile, message) {
  if (!waReady) {
    console.log('[-] WhatsApp not ready, cannot send to', mobile);
    return false;
  }
  try {
    const phone = formatPhone(mobile);
    await waClient.sendMessage(phone, message);
    console.log('[+] Sent to', mobile, ':', message.substring(0, 50) + '...');
    return true;
  } catch (err) {
    console.error('[-] Failed to send to', mobile, ':', err.message);
    return false;
  }
}

// ===== SEED DATA FROM members.json TO MONGODB =====
async function seedMembersFromFile() {
  try {
    const count = await Member.countDocuments();
    if (count > 0) {
      console.log(`[+] MongoDB already has ${count} members — skipping seed`);
      return;
    }
    if (!fs.existsSync(MEMBERS_FILE)) {
      console.log('[+] No members.json found — starting fresh');
      return;
    }
    const fileData = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
    if (!Array.isArray(fileData) || fileData.length === 0) {
      console.log('[+] members.json is empty — skipping seed');
      return;
    }
    const docs = fileData.map(m => ({
      memberId: m.id,
      name: m.name,
      mobile: m.mobile,
      plan: m.plan,
      timing: m.timing,
      status: m.status,
      joinDate: m.joinDate,
      expiryDate: m.expiryDate
    }));
    await Member.insertMany(docs);
    console.log(`[+] Seeded ${docs.length} members from members.json to MongoDB`);
  } catch (err) {
    console.error('[-] Seed error:', err.message);
  }
}

// ===== EXPRESS SERVER =====
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api', memberRoutes);
app.use('/api', paymentRoutes);
app.use('/api', settingsRoutes);
app.use('/api', trainerRoutes);

// WA status endpoint
app.get('/api/status', (req, res) => {
  const alertCounts = { '2day': 0, '1day': 0, 'expired': 0 };
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
  for (const [key, val] of Object.entries(sentAlerts)) {
    if (key.includes(todayKey)) {
      if (alertCounts[val.alertType] !== undefined) alertCounts[val.alertType]++;
    }
  }
  res.json({
    waReady,
    waQR,
    alertsSentToday: Object.values(alertCounts).reduce((a, b) => a + b, 0),
    alertCounts,
    lastCheck: new Date().toISOString()
  });
});

// QR endpoint
app.get('/api/qr', (req, res) => {
  res.json({ qr: waQR, waReady });
});

// Send WhatsApp manually
app.post('/api/send-now', async (req, res) => {
  const { memberId, customMessage } = req.body;
  let member;
  try {
    member = await Member.findOne({ memberId });
  } catch (e) {
    return res.json({ success: false, error: 'Database error' });
  }
  if (!member) return res.json({ success: false, error: 'Member not found' });
  const msg = customMessage || `Dear ${member.name}, this is a test notification from RS MULTI GYM.`;
  const success = await sendWhatsApp(member.mobile, msg);
  res.json({ success, member: member.name, mobile: member.mobile });
});

// Serve frontend files
app.use(express.static(path.join(__dirname, '..')));
app.use(express.static(path.join(__dirname, 'public')));

// ===== START =====
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[+] Connected to MongoDB Atlas');
    await seedMembersFromFile();
  } catch (err) {
    console.error('[-] MongoDB connection failed:', err.message);
    console.log('[!] Server will start without database — frontend will show errors');
  }

  app.listen(PORT, () => {
    console.log(`[+] Server running on http://localhost:${PORT}`);
    console.log(`[+] Open http://localhost:${PORT} in your browser`);
  });
}

start();
