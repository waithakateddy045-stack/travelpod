const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { followUser, unfollowUser } = require('../controllers/followController');

router.post('/:userId', authenticate, followUser);
router.delete('/:userId', authenticate, unfollowUser);

module.exports = router;
