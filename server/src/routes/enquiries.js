const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { submitEnquiry, getEnquiries, respondToEnquiry } = require('../controllers/enquiryController');

router.post('/', authenticate, submitEnquiry);
router.get('/', authenticate, getEnquiries);
router.put('/:id/respond', authenticate, respondToEnquiry);

module.exports = router;
