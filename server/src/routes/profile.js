const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
    getProfileByHandle, getProfilePosts, getProfileReviews,
    updateMyProfile, updateBusinessProfile,
    submitVerification, getVerificationStatus,
} = require('../controllers/profileController');

// Public (with optional auth for follow status)
router.get('/:handle', optionalAuth, getProfileByHandle);
router.get('/:handle/posts', getProfilePosts);
router.get('/:handle/reviews', getProfileReviews);

// Authenticated
router.put('/me', authenticate, updateMyProfile);
router.put('/business', authenticate, updateBusinessProfile);

// Verification
router.post('/verification', authenticate, submitVerification);
router.get('/verification/status', authenticate, getVerificationStatus);

module.exports = router;
