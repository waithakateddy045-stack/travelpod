const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const { submitBoost, getMyBoosts, getAdminBoosts, approveBoost, rejectBoost } = require('../controllers/boostController');

// User endpoints
router.post('/boost', authenticate, submitBoost);
router.get('/my-boosts', authenticate, getMyBoosts);

// Admin endpoints
router.get('/boosts', authenticate, adminOnly, getAdminBoosts);
router.patch('/boosts/:id/approve', authenticate, adminOnly, approveBoost);
router.patch('/boosts/:id/reject', authenticate, adminOnly, rejectBoost);

module.exports = router;
