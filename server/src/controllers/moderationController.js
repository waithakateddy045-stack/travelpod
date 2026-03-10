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
                entityType,
                entityId,
                reason,
                detail,
                postId: postId || (entityType === 'POST' ? entityId : null),
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

        const where = { status };
        if (entityType) where.entityType = entityType;

        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    reporter: { select: { profile: { select: { displayName: true, handle: true } } } },
                    post: { select: { id: true, title: true, videoUrl: true, thumbnailUrl: true } },
                },
            }),
            prisma.report.count({ where }),
        ]);

        // Manually enrich for Comments and Users if needed
        const enriched = await Promise.all(reports.map(async (r) => {
            if (r.entityType === 'COMMENT') {
                const comment = await prisma.comment.findUnique({
                    where: { id: r.entityId },
                    select: { content: true, user: { select: { profile: { select: { handle: true } } } } }
                });
                return { ...r, comment };
            }
            if (r.entityType === 'USER') {
                const user = await prisma.user.findUnique({
                    where: { id: r.entityId },
                    select: { profile: { select: { handle: true, displayName: true } } }
                });
                return { ...r, reportedUser: user };
            }
            return r;
        }));

        res.json({ success: true, reports: enriched, total, page });
    } catch (err) { next(err); }
};

// PUT /api/admin/reports/:id/resolve — Admin: Mark report as resolved (no action)
const resolveReport = async (req, res, next) => {
    try {
        const report = await prisma.report.findUnique({ where: { id: req.params.id } });
        if (!report) throw new AppError('Report not found', 404);

        await prisma.$transaction([
            prisma.report.update({
                where: { id: req.params.id },
                data: { status: 'RESOLVED' }
            }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'REPORT_RESOLVE',
                    targetAccountId: report.reporterId,
                    targetEntityId: report.id,
                    targetEntityType: 'REPORT',
                    reason: 'Manually marked as OK/Resolved'
                }
            })
        ]);

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

            // 2. Mark report(s) as actioned
            await tx.report.update({
                where: { id: reportId },
                data: { status: 'ACTION_TAKEN' }
            });

            // 3. Log the action
            let logTargetAccountId = null;
            if (report.entityType === 'USER') {
                logTargetAccountId = report.entityId;
            } else if (report.entityType === 'POST') {
                const post = await tx.post.findUnique({ where: { id: report.entityId }, select: { userId: true } });
                logTargetAccountId = post?.userId;
            } else if (report.entityType === 'COMMENT') {
                const comment = await tx.comment.findUnique({ where: { id: report.entityId }, select: { userId: true } });
                logTargetAccountId = comment?.userId;
            }

            await tx.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: action === 'SUSPEND_USER' ? 'SUSPENSION' : 'CONTENT_REMOVAL',
                    targetAccountId: logTargetAccountId,
                    targetEntityId: report.entityId,
                    targetEntityType: report.entityType,
                    reason: reason || 'Moderation action taken',
                    durationDays: durationDays || null
                }
            });

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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const [logs, total] = await Promise.all([
            prisma.adminActionLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    admin: { select: { email: true, profile: { select: { displayName: true } } } }
                }
            }),
            prisma.adminActionLog.count()
        ]);

        res.json({ success: true, logs, total, page });
    } catch (err) { next(err); }
};

module.exports = { reportEntity, getReports, resolveReport, suspendUser, unsuspendUser, performModerationAction, getAdminLogs };
