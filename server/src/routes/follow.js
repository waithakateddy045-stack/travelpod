const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { followUser, unfollowUser, getFollowers, getFollowing } = require('../controllers/followController');

router.post('/:userId', authenticate, followUser);
router.delete('/:userId', authenticate, unfollowUser);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

module.exports = router;
