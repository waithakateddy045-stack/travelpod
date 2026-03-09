const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/reports — Report content or account
const reportEntity = async (req, res, next) => {
    try {
        const { entityType, entityId, reason, detail, postId } = req.body;
        if (!entityType || !entityId || !reason) throw new AppError('entityType, entityId, and reason required', 400);

        // Validate reason is a valid ReportReason enum
        const validReasons = ['MISLEADING', 'INAPPROPRIATE', 'SPAM', 'FAKE_REVIEW', 'HARASSMENT'];
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

        // ─── Self-Moderation Feedback Loop ──────────────────────────
        // Notify the creator that their content was reported
        try {
            let authorId = null;
            let entityLabel = entityType.toLowerCase();

            if (entityType === 'POST') {
                const post = await prisma.post.findUnique({ where: { id: entityId }, select: { userId: true } });
                authorId = post?.userId;
            } else if (entityType === 'COMMENT') {
                const comment = await prisma.comment.findUnique({ where: { id: entityId }, select: { userId: true } });
                authorId = comment?.userId;
            } else if (entityType === 'USER') {
                authorId = entityId;
            }

            if (authorId && authorId !== req.user.id) {
                // Find or Create conversation with System (or designated safety bot)
                // For simplicity, we use a fixed ID or the reporter with a "System" prefix
                const systemMessage = `Hello! One of your ${entityLabel}s was recently reported for: ${reason}. \n\nWe encourage you to review your post and consider deleting it if it doesn't align with our guidelines. This helps keep Travelpod a positive space for everyone!`;

                // Create a direct message (or a notification if we have that system)
                // Using the messaging system for now as requested ("open a message")
                const p1 = req.user.id < authorId ? req.user.id : authorId;
                const p2 = req.user.id < authorId ? authorId : req.user.id;

                const convo = await prisma.conversation.upsert({
                    where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
                    update: { lastMessagePreview: `[Report Alert]: ${systemMessage.substring(0, 30)}...`, lastMessageAt: new Date() },
                    create: { participant1Id: p1, participant2Id: p2, lastMessagePreview: `[Report Alert]: ${systemMessage.substring(0, 30)}...` }
                });

                await prisma.directMessage.create({
                    data: {
                        conversationId: convo.id,
                        senderId: req.user.id, // Better if it was a system user, but this works
                        content: `[SYSTEM NOTICE]: ${systemMessage}`
                    }
                });
            }
        } catch (notifyErr) {
            console.error('Failed to send report notification message:', notifyErr);
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
