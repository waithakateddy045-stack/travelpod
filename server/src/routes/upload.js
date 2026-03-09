const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generateSuggestions, generateBroadcastContent } = require('../utils/geminiService');

// POST /api/upload/ai-suggestions — AI content suggestions
router.post('/ai-suggestions', authenticate, async (req, res, next) => {
    try {
        const { fileName, fileType, duration, title, description, isTextPost } = req.body;
        const suggestions = await generateSuggestions({ 
            fileName, fileType, duration, title, description, isTextPost 
        });
        res.json({ success: true, suggestions });
    } catch (err) { next(err); }
});

// POST /api/upload/broadcast-ai — AI broadcast content
router.post('/broadcast-ai', authenticate, async (req, res, next) => {
    try {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ error: 'Topic required' });
        const result = await generateBroadcastContent(topic);
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
});

module.exports = router;
