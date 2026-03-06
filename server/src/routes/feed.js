const express = require('express');
const router = express.Router();
const { getFeed, getDestinationsFeed } = require('../controllers/feedController');
const authenticate = require('../middleware/authenticate');

// Public routes (controller handles optional req.user internally)
router.get('/', getFeed);
router.get('/destinations', getDestinationsFeed);

module.exports = router;
