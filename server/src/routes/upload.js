const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getAISuggestions } = require('../utils/geminiService');

// POST /api/upload/suggestions — AI content suggestions
router.post('/suggestions', authenticate, async (req, res, next) => {
    try {
        const { type, context, fileName, fileType, duration } = req.body;

        // Map payload for getAISuggestions
        const mappedFileName = fileName || context || '';
        const mappedFileType = fileType || type || 'content';
        const mappedDuration = duration || 0;

        const result = await getAISuggestions({ fileName: mappedFileName, fileType: mappedFileType, duration: mappedDuration });

        const mappedData = {
            title: result.titles ? result.titles[0] : (result.title || ''),
            description: result.description,
            tags: result.tags,
            category: result.category,
            location: result.location
        };

        res.json({ success: true, data: mappedData });
    } catch (err) { next(err); }
});

module.exports = router;
