const express = require('express');
const router = express.Router();
const { getFeed } = require('../controllers/feedController');
const { optionalAuth } = require('../middleware/auth');

// Public route — optionalAuth attaches user if JWT present, so the
// feed algorithm can personalise; guests get a generic discovery feed.
router.get('/', optionalAuth, getFeed);

module.exports = router;
