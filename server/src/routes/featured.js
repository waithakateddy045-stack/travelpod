const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const { createFeatured, getFeatured } = require('../controllers/featuredController');

router.get('/', getFeatured);
router.post('/', authenticate, adminOnly, createFeatured);

module.exports = router;
