const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const { submitReport, getReports, resolveReport, suspendUser, unsuspendUser } = require('../controllers/moderationController');
const { getDashboardStats, getUsers, getVerifications, reviewVerification } = require('../controllers/adminController');
const { getModerationQueue, moderatePost } = require('../controllers/postController');
const { getAdminVerifications, approveVerification, rejectVerification } = require('../controllers/verificationController');

// ── Dashboard Stats ──────────────────────────────────────────
router.get('/stats', authenticate, adminOnly, getDashboardStats);

// ── Users Management ──────────────────────────────────────────
router.get('/users', authenticate, adminOnly, getUsers);
router.put('/users/:id/suspend', authenticate, adminOnly, suspendUser);
router.put('/users/:id/unsuspend', authenticate, adminOnly, unsuspendUser);

// ── Moderation Queue ──────────────────────────────────────────
router.get('/moderation', authenticate, adminOnly, getModerationQueue);
router.put('/moderation/:id', authenticate, adminOnly, moderatePost);

// ── Reports ────────────────────────────────────────────────────
router.post('/reports', authenticate, submitReport);
router.get('/reports', authenticate, adminOnly, getReports);
router.put('/reports/:id/resolve', authenticate, adminOnly, resolveReport);

// ── Business Verifications (legacy)
router.get('/verifications', authenticate, adminOnly, getVerifications);
router.put('/verifications/:id', authenticate, adminOnly, reviewVerification);

// ── Enhanced Business Verifications
router.get('/business-verifications', authenticate, adminOnly, getAdminVerifications);
router.patch('/business-verifications/:id/approve', authenticate, adminOnly, approveVerification);
router.patch('/business-verifications/:id/reject', authenticate, adminOnly, rejectVerification);

module.exports = router;
