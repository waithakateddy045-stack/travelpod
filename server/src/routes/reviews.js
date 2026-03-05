const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { submitReview, getBusinessReviews, respondToReview, disputeReview } = require('../controllers/reviewController');

router.post('/', authenticate, submitReview);
router.get('/business/:businessId', getBusinessReviews);
router.post('/:reviewId/respond', authenticate, respondToReview);
router.post('/:reviewId/dispute', authenticate, disputeReview);

module.exports = router;
