const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getConversations, createConversation, getMessages, sendMessage } = require('../controllers/messageController');

router.get('/conversations', authenticate, getConversations);
router.post('/conversations', authenticate, createConversation);
router.get('/:conversationId', authenticate, getMessages);
router.post('/:conversationId', authenticate, sendMessage);

module.exports = router;
