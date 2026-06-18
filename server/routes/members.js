const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const Payment = require('../models/Payment');

router.get('/members', async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
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
