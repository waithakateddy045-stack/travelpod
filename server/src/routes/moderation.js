const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { reportEntity } = require('../controllers/moderationController');

// POST /api/reports — Generic reporting for any entity
router.post('/', optionalAuth, reportEntity);

module.exports = router;
