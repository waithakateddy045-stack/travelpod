const express = require('express');
const router = express.Router();
const { search } = require('../controllers/searchController');
const authenticate = require('../middleware/authenticate');

// Public route (controller handles optional req.user internally)
router.get('/', search);

module.exports = router;
