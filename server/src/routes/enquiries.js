const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createEnquiry, getEnquiries, respondToEnquiry, updateEnquiryStatus } = require('../controllers/enquiryController');

router.post('/', authenticate, createEnquiry);
router.get('/', authenticate, getEnquiries);
router.post('/:id/respond', authenticate, respondToEnquiry);
router.put('/:id/status', authenticate, updateEnquiryStatus);

module.exports = router;
