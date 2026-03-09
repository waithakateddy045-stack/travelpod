const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createCollaboration, getCollaborations, acceptCollaboration, declineCollaboration, completeCollaboration } = require('../controllers/collaborationRequestController');

router.post('/', authenticate, createCollaboration);
router.get('/', authenticate, getCollaborations);
router.patch('/:id/accept', authenticate, acceptCollaboration);
router.patch('/:id/decline', authenticate, declineCollaboration);
router.patch('/:id/complete', authenticate, completeCollaboration);

module.exports = router;
