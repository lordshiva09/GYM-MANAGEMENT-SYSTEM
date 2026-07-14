const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/payments', authenticateToken, [
  body('member').trim().notEmpty().withMessage('Member name required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('txnId').trim().notEmpty().withMessage('Transaction ID required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.json({ success: true, payment });
  } catch (err) {
    console.error('[-] POST /payments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/payments/:txnId', authenticateToken, async (req, res) => {
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

router.delete('/payments/:txnId', authenticateToken, async (req, res) => {
  try {
    const result = await Payment.deleteOne({ txnId: req.params.txnId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
