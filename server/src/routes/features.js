const express = require('express');
const router = express.Router();
const { getFeatures } = require('../controllers/featureController');

// Public features endpoint used by web and mobile clients
router.get('/', getFeatures);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const { getAllFeatures, toggleFeature } = require('../controllers/featureController');

// GET /api/features — public list of feature flags
router.get('/', getAllFeatures);

// PATCH /api/features/:name — admin toggle (also mounted under /api/admin/features/:name)
router.patch('/:name', authenticate, adminOnly, toggleFeature);

module.exports = router;
