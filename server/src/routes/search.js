const express = require('express');
const router = express.Router();
const { search } = require('../controllers/searchController');

// Public route (controller handles optional req.user internally)
router.get('/', search);

module.exports = router;
