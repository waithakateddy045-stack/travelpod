const express = require('express');
const router = express.Router();
const { getFeed } = require('../controllers/feedController');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { recordImpression } = require('../controllers/promotedController');

// Public route — optionalAuth attaches user if JWT present
router.get('/', optionalAuth, getFeed);

// Track promoted post impressions
router.post('/impression', optionalAuth, recordImpression);

module.exports = router;
