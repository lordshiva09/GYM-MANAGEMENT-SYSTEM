const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const Payment = require('../models/Payment');

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

function computeStatus(expiryDateStr) {
  if (!expiryDateStr) return 'Active';
  const now = new Date();
  const exp = parseDate(expiryDateStr);
  const diffMs = exp - now;
  const minsLeft = diffMs / (1000 * 60);
  if (minsLeft <= 0) return 'Expired';
  if (minsLeft <= 2880) return 'Pending';
  return 'Active';
}

router.get('/members', async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    const bulkOps = [];
    for (const m of members) {
      const correctStatus = computeStatus(m.expiryDate);
      if (m.status !== correctStatus) {
        m.status = correctStatus;
        bulkOps.push({
          updateOne: { filter: { memberId: m.memberId }, update: { $set: { status: correctStatus } } }
        });
      }
    }
    if (bulkOps.length > 0) {
      await Member.bulkWrite(bulkOps);
    }
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/members', async (req, res) => {
  try {
    const member = new Member(req.body);
    await member.save();
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/members/:memberId', async (req, res) => {
  try {
    const member = await Member.findOneAndUpdate(
      { memberId: req.params.memberId },
      req.body,
      { new: true }
    );
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json({ success: true, member });
  } catch (err) {
    console.error('[-] PUT /members/:memberId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/members/:memberId', async (req, res) => {
  try {
    const member = await Member.findOne({ memberId: req.params.memberId });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    const name = member.name;
    await Member.deleteOne({ memberId: req.params.memberId });
    const delPayments = await Payment.deleteMany({ member: name });
    res.json({ success: true, deletedPayments: delPayments.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
