const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Member = require('../models/Member');
const { generateToken, authenticateToken, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const LOGIN_ATTEMPTS = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;

router.post('/login', [
  body('memberId').trim().notEmpty().withMessage('Member ID required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { memberId, password } = req.body;
  const attemptKey = memberId;

  if (LOGIN_ATTEMPTS[attemptKey]) {
    const { count, lastAttempt } = LOGIN_ATTEMPTS[attemptKey];
    if (count >= MAX_ATTEMPTS && Date.now() - lastAttempt < LOCKOUT_TIME) {
      const remaining = Math.ceil((LOCKOUT_TIME - (Date.now() - lastAttempt)) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${remaining} minutes.` });
    }
    if (Date.now() - lastAttempt >= LOCKOUT_TIME) {
      LOGIN_ATTEMPTS[attemptKey] = { count: 0, lastAttempt: Date.now() };
    }
  }

  try {
    const member = await Member.findOne({ memberId });
    if (!member) {
      if (!LOGIN_ATTEMPTS[attemptKey]) LOGIN_ATTEMPTS[attemptKey] = { count: 0, lastAttempt: Date.now() };
      LOGIN_ATTEMPTS[attemptKey].count++;
      LOGIN_ATTEMPTS[attemptKey].lastAttempt = Date.now();
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!member.password) {
      return res.status(401).json({ error: 'Password not set. Please contact admin.' });
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) {
      if (!LOGIN_ATTEMPTS[attemptKey]) LOGIN_ATTEMPTS[attemptKey] = { count: 0, lastAttempt: Date.now() };
      LOGIN_ATTEMPTS[attemptKey].count++;
      LOGIN_ATTEMPTS[attemptKey].lastAttempt = Date.now();
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    delete LOGIN_ATTEMPTS[attemptKey];

    const token = generateToken(member);
    const { password: _, ...memberData } = member.toObject();

    res.json({
      success: true,
      token,
      member: memberData
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/register', authenticateToken, requireAdmin, [
  body('memberId').trim().notEmpty().withMessage('Member ID required'),
  body('name').trim().notEmpty().withMessage('Name required'),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
  body('role').optional().isIn(['admin', 'staff']).withMessage('Role must be admin or staff')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { memberId, name, password, role } = req.body;

  try {
    const existing = await Member.findOne({ memberId });
    if (existing) {
      return res.status(400).json({ error: 'Member ID already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const member = new Member({
      memberId,
      name,
      password: hashedPassword,
      role: role || 'admin'
    });
    await member.save();

    const { password: _, ...memberData } = member.toObject();
    res.json({ success: true, member: memberData });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 4 }).withMessage('New password must be at least 4 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const member = await Member.findOne({ memberId: req.user.id });
    if (!member) return res.status(404).json({ error: 'User not found.' });

    const valid = await bcrypt.compare(currentPassword, member.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    member.password = await bcrypt.hash(newPassword, 10);
    await member.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const member = await Member.findOne({ memberId: req.user.id }).select('-password');
    if (!member) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/setup-status', async (req, res) => {
  try {
    const adminExists = await Member.findOne({ role: 'admin', password: { $exists: true, $ne: null } });
    res.json({ setupComplete: !!adminExists });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/setup-admin', async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const adminExists = await Member.findOne({ role: 'admin', password: { $exists: true, $ne: null } });
    if (adminExists) {
      return res.status(400).json({ error: 'Admin already set up. Use change-password instead.' });
    }

    const { memberId, name, password } = req.body;
    if (!memberId || !name || !password) {
      return res.status(400).json({ error: 'memberId, name, and password are required.' });
    }

    let member = await Member.findOne({ memberId });
    if (member) {
      member.password = await bcrypt.hash(password, 10);
      member.role = 'admin';
      await member.save();
    } else {
      member = new Member({
        memberId,
        name,
        password: await bcrypt.hash(password, 10),
        role: 'admin'
      });
      await member.save();
    }

    const { password: _, ...memberData } = member.toObject();
    const token = generateToken(member);

    res.json({ success: true, token, member: memberData });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
