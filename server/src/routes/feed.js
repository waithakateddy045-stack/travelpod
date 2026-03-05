const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { getFeed } = require('../controllers/feedController');

router.get('/', optionalAuth, getFeed);

module.exports = router;
