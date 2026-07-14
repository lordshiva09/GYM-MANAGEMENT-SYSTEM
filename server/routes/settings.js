const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

router.get('/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'gym_settings' });
    if (!settings) {
      settings = await new Settings({ key: 'gym_settings' }).save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { key: 'gym_settings' },
      { ...req.body, key: 'gym_settings' },
      { upsert: true, new: true }
    );
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
