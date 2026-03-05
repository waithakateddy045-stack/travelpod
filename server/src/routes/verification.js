const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    applyForVerification, getVerificationStatus, getPublicVerification,
} = require('../controllers/verificationController');

router.post('/business/apply', authenticate, applyForVerification);
router.get('/business/status', authenticate, getVerificationStatus);
router.get('/business/:userId', getPublicVerification);

module.exports = router;
