const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getNotifications, markAllRead, markRead } = require('../controllers/notificationController');

router.get('/', authenticate, getNotifications);
router.put('/read-all', authenticate, markAllRead);
router.put('/:id/read', authenticate, markRead);

module.exports = router;
