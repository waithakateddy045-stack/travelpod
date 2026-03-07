const express = require('express');
const router = express.Router();
const { getFollowersByUsername, getFollowingByUsername } = require('../controllers/userController');

// Public routes for getting followers and following lists
router.get('/:username/followers', getFollowersByUsername);
router.get('/:username/following', getFollowingByUsername);

module.exports = router;
