const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getAISuggestions } = require('../utils/geminiService');

// POST /api/upload/suggestions — AI content suggestions
router.post('/suggestions', authenticate, async (req, res, next) => {
    try {
        const result = await getAISuggestions(req.body);
        res.json(result);
    } catch (err) { next(err); }
});

module.exports = router;
