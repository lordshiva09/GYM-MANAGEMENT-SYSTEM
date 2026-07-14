const express = require('express');
const router = express.Router();
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const { authenticateToken } = require('../middleware/auth');

const RP_NAME = 'RS MULTI GYM';
const RP_ID = 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

const pendingChallenges = {};

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

router.post('/webauthn/register/start', authenticateToken, async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'Member ID required' });

  try {
    const member = await Member.findOne({ memberId });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const options = {
      challenge: Buffer.from(require('crypto').randomBytes(32)).toString('base64url'),
      rp: { name: RP_NAME, id: RP_ID },
      user: {
        id: Buffer.from(memberId).toString('base64url'),
        name: memberId,
        displayName: member.name
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    };

    pendingChallenges[memberId] = {
      challenge: options.challenge,
      timestamp: Date.now()
    };

    setTimeout(() => { delete pendingChallenges[memberId]; }, 120000);

    res.json({ options });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webauthn/register/finish', authenticateToken, async (req, res) => {
  const { memberId, credential } = req.body;
  if (!memberId || !credential) return res.status(400).json({ error: 'Member ID and credential required' });

  try {
    const pending = pendingChallenges[memberId];
    if (!pending) return res.status(400).json({ error: 'No pending registration. Start again.' });

    delete pendingChallenges[memberId];

    const member = await Member.findOne({ memberId });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const credentialId = credential.id;
    const alreadyEnrolled = member.webAuthnCredentials.some(c => c.credentialId === credentialId);
    if (alreadyEnrolled) return res.status(400).json({ error: 'Fingerprint already registered' });

    const newCredential = {
      credentialId: credentialId,
      publicKey: credential.response?.attestationObject || 'demo-key',
      counter: 0,
      deviceType: credential.type || 'public-key',
      backedUp: false,
      transports: credential.response?.transports || ['internal'],
      enrolledAt: new Date().toISOString()
    };

    member.webAuthnCredentials.push(newCredential);
    member.fingerprintEnrolled = true;
    member.fingerprintEnrolledAt = new Date().toISOString();
    await member.save();

    res.json({ success: true, message: 'Fingerprint enrolled successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webauthn/authenticate/start', async (req, res) => {
  try {
    const options = {
      challenge: Buffer.from(require('crypto').randomBytes(32)).toString('base64url'),
      rpId: RP_ID,
      userVerification: 'required',
      timeout: 60000
    };

    const allMembers = await Member.find({ fingerprintEnrolled: true });
    options.allowCredentials = allMembers.flatMap(m =>
      m.webAuthnCredentials.map(c => ({
        id: c.credentialId,
        type: 'public-key',
        transports: c.transports || ['internal']
      }))
    );

    const challengeKey = 'auth_' + Date.now();
    pendingChallenges[challengeKey] = {
      challenge: options.challenge,
      timestamp: Date.now()
    };

    setTimeout(() => { delete pendingChallenges[challengeKey]; }, 120000);

    res.json({ options, challengeKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webauthn/authenticate/finish', async (req, res) => {
  const { credential, challengeKey } = req.body;
  if (!credential) return res.status(400).json({ error: 'Credential required' });

  try {
    const pending = pendingChallenges[challengeKey || ''];
    delete pendingChallenges[challengeKey || ''];

    let matchedMember = null;
    let matchedCredential = null;

    const allMembers = await Member.find({ fingerprintEnrolled: true });
    for (const member of allMembers) {
      const cred = member.webAuthnCredentials.find(c => c.credentialId === credential.id);
      if (cred) {
        matchedMember = member;
        matchedCredential = cred;
        break;
      }
    }

    if (!matchedMember) {
      return res.status(401).json({ success: false, error: 'Fingerprint not recognized' });
    }

    matchedCredential.counter++;
    await matchedMember.save();

    const now = new Date();
    const today = formatDate(now);
    const existing = await Attendance.findOne({ memberId: matchedMember.memberId, date: today });

    if (existing) {
      return res.json({
        success: true,
        message: `Already checked in today at ${existing.checkInTime}`,
        member: { name: matchedMember.name, plan: matchedMember.plan },
        checkInTime: existing.checkInTime,
        alreadyCheckedIn: true
      });
    }

    const record = new Attendance({
      memberId: matchedMember.memberId,
      memberName: matchedMember.name,
      date: today,
      checkInTime: formatTime(now),
      timestamp: now.getTime(),
      method: 'webauthn',
      synced: true
    });
    await record.save();

    res.json({
      success: true,
      message: `Welcome ${matchedMember.name}! Attendance marked.`,
      member: { name: matchedMember.name, plan: matchedMember.plan, memberId: matchedMember.memberId },
      checkInTime: formatTime(now),
      record
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webauthn/demo-scan', async (req, res) => {
  try {
    const enrolledMembers = await Member.find({ fingerprintEnrolled: true });
    if (enrolledMembers.length === 0) {
      return res.status(400).json({ error: 'No members enrolled yet. Please enroll first.' });
    }

    const randomMember = enrolledMembers[Math.floor(Math.random() * enrolledMembers.length)];

    const now = new Date();
    const today = formatDate(now);
    const existing = await Attendance.findOne({ memberId: randomMember.memberId, date: today });

    if (existing) {
      return res.json({
        success: true,
        message: `Already checked in today at ${existing.checkInTime}`,
        member: { name: randomMember.name, plan: randomMember.plan },
        checkInTime: existing.checkInTime,
        alreadyCheckedIn: true
      });
    }

    const record = new Attendance({
      memberId: randomMember.memberId,
      memberName: randomMember.name,
      date: today,
      checkInTime: formatTime(now),
      timestamp: now.getTime(),
      method: 'demo',
      synced: true
    });
    await record.save();

    res.json({
      success: true,
      message: `Demo scan: ${randomMember.name} attendance marked!`,
      member: { name: randomMember.name, plan: randomMember.plan, memberId: randomMember.memberId },
      checkInTime: formatTime(now),
      record
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/webauthn/status', async (req, res) => {
  try {
    const enrolled = await Member.countDocuments({ fingerprintEnrolled: true });
    const today = formatDate(new Date());
    const todayAttendance = await Attendance.countDocuments({ date: today });
    res.json({
      enrolledMembers: enrolled,
      todayAttendance,
      mode: 'demo',
      message: enrolled > 0 ? 'Ready for demo scans' : 'No members enrolled yet'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
