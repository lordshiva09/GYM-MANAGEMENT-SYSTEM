const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Member = require('../models/Member');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

router.get('/attendance', authenticateToken, async (req, res) => {
  try {
    const { date, memberId, limit } = req.query;
    const query = {};
    if (date) query.date = date;
    if (memberId) query.memberId = memberId;
    const records = await Attendance.find(query).sort({ timestamp: -1 }).limit(parseInt(limit) || 100);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attendance/today', authenticateToken, async (req, res) => {
  try {
    const today = formatDate(new Date());
    const records = await Attendance.find({ date: today }).sort({ timestamp: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attendance/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const records = await Attendance.find({ memberId: req.params.memberId }).sort({ timestamp: -1 }).limit(30);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attendance/stats', authenticateToken, async (req, res) => {
  try {
    const today = formatDate(new Date());
    const todayRecords = await Attendance.find({ date: today });
    const uniqueMembers = [...new Set(todayRecords.map(r => r.memberId))];
    const totalMembers = await Member.countDocuments({ status: 'Active' });
    res.json({
      today: todayRecords.length,
      uniqueMembers: uniqueMembers.length,
      totalActive: totalMembers,
      absent: totalMembers - uniqueMembers.length,
      records: todayRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attendance/absent', authenticateToken, async (req, res) => {
  try {
    const today = formatDate(new Date());
    const todayRecords = await Attendance.find({ date: today });
    const presentIds = todayRecords.map(r => r.memberId);
    const absentMembers = await Member.find({
      memberId: { $nin: presentIds },
      status: 'Active'
    }).select('memberId name mobile plan timing');
    res.json(absentMembers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attendance/monthly/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month) - 1];
    const records = await Attendance.find({
      date: { $regex: `${monthName}.*${year}` }
    }).sort({ timestamp: -1 });

    const memberStats = {};
    for (const record of records) {
      if (!memberStats[record.memberId]) {
        memberStats[record.memberId] = {
          memberId: record.memberId,
          memberName: record.memberName,
          daysPresent: 0,
          dates: []
        };
      }
      memberStats[record.memberId].daysPresent++;
      memberStats[record.memberId].dates.push(record.date);
    }

    res.json({
      year: parseInt(year),
      month: parseInt(month),
      totalRecords: records.length,
      memberStats: Object.values(memberStats)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/attendance/check-in', optionalAuth, async (req, res) => {
  const { memberId, method } = req.body;
  if (!memberId) return res.status(400).json({ error: 'Member ID required' });

  try {
    const member = await Member.findOne({ memberId });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.status !== 'Active') return res.status(400).json({ error: 'Membership expired' });

    const now = new Date();
    const today = formatDate(now);
    const existing = await Attendance.findOne({ memberId, date: today });
    if (existing) return res.json({ success: true, message: 'Already checked in today', alreadyCheckedIn: true, record: existing });

    const record = new Attendance({
      memberId,
      memberName: member.name,
      date: today,
      checkInTime: formatTime(now),
      timestamp: now.getTime(),
      method: method || 'manual',
      synced: true
    });
    await record.save();

    res.json({ success: true, record, member: { name: member.name, plan: member.plan } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/attendance/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Attendance.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
