const express = require('express');
const router = express.Router();
const { performBackup, restoreBackup, getBackupStatus, cleanupOldBackups } = require('../services/backupService');
const BackupLog = require('../models/BackupLog');

router.get('/status', async (req, res) => {
  try {
    const status = await getBackupStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const backups = await BackupLog.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('backupId timestamp type uncompressedSize compressedSize status steps collections error');
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trigger', async (req, res) => {
  try {
    const type = req.body.type || 'manual';
    const result = await performBackup(type);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/restore/:backupId', async (req, res) => {
  try {
    const result = await restoreBackup(req.params.backupId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    const keepDays = req.body.keepDays || 7;
    const deleted = await cleanupOldBackups(keepDays);
    res.json({ success: true, deleted, message: `Removed ${deleted} old backups` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
