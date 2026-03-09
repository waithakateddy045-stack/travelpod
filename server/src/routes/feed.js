const express = require('express');
const router = express.Router();
const { getFeed, getFollowingFeed } = require('../controllers/feedController');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { recordImpression } = require('../controllers/promotedController');

// Public route — optionalAuth attaches user if JWT present
router.get('/', optionalAuth, getFeed);

// Protected — only following
router.get('/following', authenticate, getFollowingFeed);

// Track promoted post impressions
router.post('/impression', optionalAuth, recordImpression);

module.exports = router;
