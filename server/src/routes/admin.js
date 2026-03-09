const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const { reportEntity, getReports, resolveReport, suspendUser, unsuspendUser, performModerationAction, getAdminLogs } = require('../controllers/moderationController');
const { getDashboardStats, getUsers, getVerifications, reviewVerification, getBoards, deleteBoard, updateBoardStatus } = require('../controllers/adminController');
const { getModerationQueue, moderatePost } = require('../controllers/postController');
const { getAdminVerifications, approveVerification, rejectVerification } = require('../controllers/verificationController');
const { createPromotion, getPromotions, updatePromotion, deletePromotion } = require('../controllers/promotedController');
const { getBroadcasts, deleteBroadcast, createBroadcast } = require('../controllers/broadcastController');

// ── Dashboard Stats ──────────────────────────────────────────
router.get('/stats', authenticate, adminOnly, getDashboardStats);

// ── Users Management ──────────────────────────────────────────
router.get('/users', authenticate, adminOnly, getUsers);
router.put('/users/:id/suspend', authenticate, adminOnly, suspendUser);
router.put('/users/:id/unsuspend', authenticate, adminOnly, unsuspendUser);

// ── Moderation Queue ──────────────────────────────────────────
router.get('/moderation', authenticate, adminOnly, getModerationQueue);
router.put('/moderation/:id', authenticate, adminOnly, moderatePost);

// ── Reports & Moderation Center ──────────────────────────────
router.post('/reports', authenticate, reportEntity); // This line was moved from its original section
router.get('/reports', authenticate, adminOnly, getReports);
router.put('/reports/:id/resolve', authenticate, adminOnly, resolveReport);
router.post('/moderation/action', authenticate, adminOnly, performModerationAction);
router.get('/logs', authenticate, adminOnly, getAdminLogs);

// ── Promoted Posts / Featured Placements ───────────────────────
router.post('/promotions', authenticate, adminOnly, createPromotion);
router.get('/promotions', authenticate, adminOnly, getPromotions);
router.put('/promotions/:id', authenticate, adminOnly, updatePromotion);
router.delete('/promotions/:id', authenticate, adminOnly, deletePromotion);

// ── Broadcasts Management ─────────────────────────────────────
router.get('/broadcasts', authenticate, adminOnly, getBroadcasts);
router.post('/broadcasts', authenticate, adminOnly, createBroadcast);
router.delete('/broadcasts/:id', authenticate, adminOnly, deleteBroadcast);

// ── Business Verifications (Legacy routes now point to enhanced functions for stability)
router.get('/verifications', authenticate, adminOnly, getAdminVerifications);
router.put('/verifications/:id', authenticate, adminOnly, approveVerification);
router.patch('/verifications/:id/approve', authenticate, adminOnly, approveVerification);
router.patch('/verifications/:id/reject', authenticate, adminOnly, rejectVerification);

// ── Enhanced Business Verifications (Alias for consistency)
router.get('/business-verifications', authenticate, adminOnly, getAdminVerifications);
router.patch('/business-verifications/:id/approve', authenticate, adminOnly, approveVerification);
router.patch('/business-verifications/:id/reject', authenticate, adminOnly, rejectVerification);

// ── Trip Boards
router.get('/boards', authenticate, adminOnly, getBoards);
router.put('/boards/:id', authenticate, adminOnly, updateBoardStatus);
router.delete('/boards/:id', authenticate, adminOnly, deleteBoard);

// ── Comments
router.delete('/comments/:id', authenticate, adminOnly, async (req, res, next) => {
    try {
        await prisma.comment.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Comment removed by admin' });
    } catch (err) { next(err); }
});

module.exports = router;
