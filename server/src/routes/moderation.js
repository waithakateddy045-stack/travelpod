const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { reportEntity } = require('../controllers/moderationController');

// POST /api/reports — Generic reporting for any entity. Requires auth.
router.post('/', authenticate, reportEntity);

module.exports = router;
