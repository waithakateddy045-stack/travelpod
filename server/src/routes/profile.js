const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
    getProfileByHandle, getProfilePosts, getProfileReviews,
    updateMyProfile, updateBusinessProfile,
    submitVerification, getVerificationStatus,
} = require('../controllers/profileController');

// Public — optionalAuth so logged-in users see follow status
router.get('/:handle', optionalAuth, getProfileByHandle);
router.get('/:handle/posts', getProfilePosts);
router.get('/:handle/reviews', getProfileReviews);

// Authenticated
router.get('/me', authenticate, (req, res, next) => {
    // Redirect to the profile handle if preferred, or just return the data
    const { profileController } = require('../controllers/profileController');
    req.params.handle = req.user.username;
    return getProfileByHandle(req, res, next);
});
router.put('/me', authenticate, updateMyProfile);
router.put('/business', authenticate, updateBusinessProfile);

// Verification
router.post('/verification', authenticate, submitVerification);
router.get('/verification/status', authenticate, getVerificationStatus);

module.exports = router;
