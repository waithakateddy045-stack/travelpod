const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getUserBadges } = require('../controllers/badgeController');

router.get('/', authenticate, getUserBadges);

module.exports = router;
