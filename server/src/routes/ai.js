const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { chatWithCopilot, clearChatHistory, generatePostDetails } = require('../controllers/aiController');

// POST /api/ai/chat
router.post('/chat', authenticate, chatWithCopilot);

// POST /api/ai/clear
router.post('/clear', authenticate, clearChatHistory);

// POST /api/ai/generate-details
router.post('/generate-details', authenticate, generatePostDetails);

module.exports = router;
