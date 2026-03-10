const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { getAllBadges, getMyBadges, getUserBadges } = require('../controllers/gamificationController');

router.get('/', getAllBadges);
router.get('/all', getAllBadges);
router.get('/my', authenticate, getMyBadges);
router.get('/user/:username', getUserBadges);

module.exports = router;
