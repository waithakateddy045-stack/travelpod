const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createBroadcast, getBroadcasts, getBroadcastsForUser, markBroadcastViewed } = require('../controllers/broadcastController');

// Admin/Association: create broadcast
router.post('/', authenticate, createBroadcast);

// Admin: list all broadcasts
router.get('/', authenticate, getBroadcasts);

// User: get broadcasts targeted at them
router.get('/inbox', authenticate, getBroadcastsForUser);

// User: mark broadcast as viewed
router.put('/:id/viewed', authenticate, markBroadcastViewed);

module.exports = router;
