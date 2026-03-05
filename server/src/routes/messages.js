const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getConversations, getMessages, sendMessage } = require('../controllers/messageController');

router.get('/conversations', authenticate, getConversations);
router.get('/:conversationId', authenticate, getMessages);
router.post('/', authenticate, sendMessage);

module.exports = router;
