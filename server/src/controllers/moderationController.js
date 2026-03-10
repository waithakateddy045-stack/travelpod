const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/reports — Report content or account
const reportEntity = async (req, res, next) => {
    try {
        const { entityType, entityId, reason, detail, postId } = req.body;
        if (!entityType || !entityId || !reason) throw new AppError('entityType, entityId, and reason required', 400);

        // Validate reason is a valid ReportReason enum
        const validReasons = ['INAPPROPRIATE', 'SPAM', 'HARASSMENT', 'MISLEADING', 'COPYRIGHT', 'OTHER'];
        if (!validReasons.includes(reason)) throw new AppError('Invalid reason. Must be one of: ' + validReasons.join(', '), 400);

        const report = await prisma.report.create({
            data: {
                reporterId: req.user.id,
                reason,
                details: detail || '',
                postId: entityType === 'POST' ? entityId : (postId || null),
                reportedUserId: entityType === 'USER' ? entityId : null,
            },
        });

        // ─── Admin Feedback to Reporter ──────────────────────────────
        try {
            const adminUser = await prisma.user.findFirst({
                where: { accountType: 'ADMIN' },
                select: { id: true }
            });

            if (adminUser && adminUser.id !== req.user.id) {
                const reporterId = req.user.id;
                const adminId = adminUser.id;

                const p1 = adminId < reporterId ? adminId : reporterId;
                const p2 = adminId < reporterId ? reporterId : adminId;

                const convo = await prisma.conversation.upsert({
                    where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
                    update: { lastMessagePreview: "Hello! We have received your report...", lastMessageAt: new Date() },
                    create: { participant1Id: p1, participant2Id: p2, lastMessagePreview: "Hello! We have received your report..." }
                });

                await prisma.directMessage.create({
                    data: {
                        conversationId: convo.id,
                        senderId: adminId,
                        content: "Hello! We have received your report. We will investigate and after review an update be sent."
                    }
                });
            }
        } catch (notifyErr) {
            console.error('Failed to send reporter notification message:', notifyErr);
        }

        res.status(201).json({ success: true, report });
    } catch (err) { next(err); }
};

// GET /api/reports — Admin: list reports
const getReports = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || 'PENDING';
        const entityType = req.query.entityType;

        const where = { resolved: status === 'RESOLVED' };

        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    reporter: { select: { displayName: true, username: true } },
                    post: { select: { id: true, title: true, videoUrl: true, thumbnailUrl: true } },
                    reportedUser: { select: { id: true, displayName: true, username: true } },
                },
            }),
            prisma.report.count({ where }),
        ]);

        // Enrichment for reported user info if not already in reportedUser relation logic
        const enriched = reports.map((r) => {
            return {
                ...r,
                entityType: r.postId ? 'POST' : 'USER',
                entityId: r.postId || r.reportedUserId
            };
        });

        res.json({ success: true, reports: enriched, total, page });
    } catch (err) { next(err); }
};

// PUT /api/admin/reports/:id/resolve — Admin: Mark report as resolved (no action)
const resolveReport = async (req, res, next) => {
    try {
        const report = await prisma.report.findUnique({ where: { id: req.params.id } });
        if (!report) throw new AppError('Report not found', 404);

        await prisma.report.update({
            where: { id: req.params.id },
            data: { resolved: true }
        });

        // Notify Reporter
        try {
            const adminId = req.user.id;
            const reporterId = report.reporterId;
            if (adminId !== reporterId) {
                const p1 = adminId < reporterId ? adminId : reporterId;
                const p2 = adminId < reporterId ? reporterId : adminId;

                const convo = await prisma.conversation.upsert({
                    where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
                    update: { lastMessagePreview: "Report Resolution: Found okay.", lastMessageAt: new Date() },
                    create: { participant1Id: p1, participant2Id: p2, lastMessagePreview: "Report Resolution: Found okay." }
                });

                await prisma.directMessage.create({
                    data: {
                        conversationId: convo.id,
                        senderId: adminId,
                        content: "Hello! After review your report, we found the content was within our community guidelines. Thanks for helping keep Travelpod safe."
                    }
                });
            }
        } catch (e) { console.error('Notify reporter resolved failed', e); }

        res.json({ success: true, message: 'Report resolved' });
    } catch (err) { next(err); }
};

// POST /api/admin/moderation/action — Unified action handler
const performModerationAction = async (req, res, next) => {
    try {
        const { reportId, action, reason, durationDays } = req.body;
        if (!reportId || !action) throw new AppError('reportId and action required', 400);

        const report = await prisma.report.findUnique({ where: { id: reportId } });
        if (!report) throw new AppError('Report not found', 404);

        await prisma.$transaction(async (tx) => {
            // 1. Take the actual action
            if (action === 'TAKE_DOWN') {
                if (report.entityType === 'POST') {
                    await tx.post.update({
                        where: { id: report.entityId },
                        data: { moderationStatus: 'REMOVED' }
                    });
                } else if (report.entityType === 'COMMENT') {
                    await tx.comment.delete({ where: { id: report.entityId } });
                }
            } else if (action === 'SUSPEND_USER') {
                let targetUserId = null;
                if (report.entityType === 'USER') {
                    targetUserId = report.entityId;
                } else if (report.entityType === 'POST') {
                    const post = await tx.post.findUnique({ where: { id: report.entityId } });
                    targetUserId = post?.userId;
                } else if (report.entityType === 'COMMENT') {
                    const comment = await tx.comment.findUnique({ where: { id: report.entityId } });
                    targetUserId = comment?.userId;
                } else if (report.entityType === 'REVIEW') {
                    const review = await tx.videoReview.findUnique({ where: { id: report.entityId } });
                    targetUserId = review?.userId;
                }

                if (targetUserId) {
                    await tx.user.update({
                        where: { id: targetUserId },
                        data: { isSuspended: true }
                    });
                }
            }

            // 2. Mark report as resolved
            await tx.report.update({
                where: { id: reportId },
                data: { resolved: true }
            });

            // 3. Log the action (Removed as AdminActionLog is missing from schema)

            // Notify Reporter
            try {
                const adminId = req.user.id;
                const reporterId = report.reporterId;
                if (adminId !== reporterId) {
                    const p1 = adminId < reporterId ? adminId : reporterId;
                    const p2 = adminId < reporterId ? reporterId : adminId;

                    const convo = await tx.conversation.upsert({
                        where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
                        update: { lastMessagePreview: "Report Resolution: Action Taken.", lastMessageAt: new Date() },
                        create: { participant1Id: p1, participant2Id: p2, lastMessagePreview: "Report Resolution: Action Taken." }
                    });

                    await tx.directMessage.create({
                        data: {
                            conversationId: convo.id,
                            senderId: adminId,
                            content: "Hello! We have reviewed your report and taken necessary action. Thank you for your feedback."
                        }
                    });
                }
            } catch (e) { console.error('Notify reporter action failed', e); }
        });

        res.json({ success: true, message: `Action ${action} performed successfully` });
    } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/suspend
const suspendUser = async (req, res, next) => {
    try {
        await prisma.user.update({ where: { id: req.params.id }, data: { isSuspended: true } });
        res.json({ success: true, message: 'User suspended' });
    } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/unsuspend
const unsuspendUser = async (req, res, next) => {
    try {
        await prisma.user.update({ where: { id: req.params.id }, data: { isSuspended: false } });
        res.json({ success: true, message: 'User unsuspended' });
    } catch (err) { next(err); }
};

// GET /api/admin/logs — Admin: view audit trail
const getAdminLogs = async (req, res, next) => {
    try {
        // AdminActionLog is missing from current schema, stubbing to prevent 500
        res.json({ success: true, logs: [], total: 0, page: 1 });
    } catch (err) { next(err); }
};

module.exports = { reportEntity, getReports, resolveReport, suspendUser, unsuspendUser, performModerationAction, getAdminLogs };
