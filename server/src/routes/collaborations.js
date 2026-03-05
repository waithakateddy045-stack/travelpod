const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createCollaboration, getCollaborations, applyToCollaboration } = require('../controllers/collaborationController');

router.post('/', authenticate, createCollaboration);
router.get('/', getCollaborations);
router.post('/:id/apply', authenticate, applyToCollaboration);

module.exports = router;
