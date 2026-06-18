const express = require('express');
const router = express.Router();
const Trainer = require('../models/Trainer');

router.get('/trainers', async (req, res) => {
  try {
    const trainers = await Trainer.find().sort({ createdAt: -1 });
    res.json(trainers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trainers', async (req, res) => {
  try {
    const trainer = new Trainer(req.body);
    await trainer.save();
    res.json({ success: true, trainer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/trainers/:id', async (req, res) => {
  try {
    const result = await Trainer.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Trainer not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
