const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { trackEvent, getDashboard } = require('../controllers/analyticsController');

router.post('/event', optionalAuth, trackEvent);
router.get('/dashboard', authenticate, getDashboard);

module.exports = router;
