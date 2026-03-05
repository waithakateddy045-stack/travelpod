const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createBroadcast, getBroadcasts } = require('../controllers/broadcastController');

router.post('/', authenticate, createBroadcast);
router.get('/', authenticate, getBroadcasts);

module.exports = router;
