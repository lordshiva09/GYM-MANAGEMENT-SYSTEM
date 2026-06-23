const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');

router.get('/payments', async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/payments', async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.json({ success: true, payment });
  } catch (err) {
    console.error('[-] POST /payments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/payments/:txnId', async (req, res) => {
  try {
    const payment = await Payment.findOneAndUpdate(
      { txnId: req.params.txnId },
      req.body,
      { new: true }
    );
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/payments/:txnId', async (req, res) => {
  try {
    const result = await Payment.deleteOne({ txnId: req.params.txnId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
