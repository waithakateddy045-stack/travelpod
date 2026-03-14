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

                // Find or create conversation
                let convo = await prisma.conversation.findFirst({
                    where: {
                        participants: {
                            some: { userId: adminId },
                        },
                        AND: {
                            participants: {
                                some: { userId: reporterId },
                            },
                        }
                    }
                });

                if (!convo) {
                    convo = await prisma.conversation.create({
                        data: {
                            participants: {
                                create: [{ userId: adminId }, { userId: reporterId }]
                            }
                        }
                    });
                }

                await prisma.message.create({
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
                // Find or create conversation
                let convo = await prisma.conversation.findFirst({
                    where: {
                        participants: {
                            some: { userId: adminId },
                        },
                        AND: {
                            participants: {
                                some: { userId: reporterId },
                            },
                        }
                    }
                });

                if (!convo) {
                    convo = await prisma.conversation.create({
                        data: {
                            participants: {
                                create: [{ userId: adminId }, { userId: reporterId }]
                            }
                        }
                    });
                }

                await prisma.message.create({
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
                if (report.postId) {
                    await tx.post.update({
                        where: { id: report.postId },
                        data: { moderationStatus: 'REMOVED' }
                    });
                }
                // Comments were previously using report.entityId but now we logic based on postId/userId
                // However, the original report entity might be a comment. 
                // Let's check if the report specifically targets a comment if we added commentId to schema.
                // Since it's not there, we'll stick to POST/USER for now or fix how reports are created.
            } else if (action === 'SUSPEND_USER') {
                let targetUserId = report.reportedUserId;
                if (!targetUserId && report.postId) {
                    const post = await tx.post.findUnique({ where: { id: report.postId } });
                    targetUserId = post?.userId;
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

            // 3. Log the action
            await tx.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: action,
                    targetEntityType: report.postId ? 'POST' : (report.reportedUserId ? 'USER' : 'UNKNOWN'),
                    targetEntityId: report.postId || report.reportedUserId || 'unknown',
                    reason: reason || report.reason,
                    details: {
                        reportId,
                        originalEntityType: report.postId ? 'POST' : 'USER',
                        durationDays
                    }
                }
            });

            // Notify Reporter
            try {
                const adminId = req.user.id;
                const reporterId = report.reporterId;
                if (adminId !== reporterId) {
                    // Find or create conversation
                    let convo = await tx.conversation.findFirst({
                        where: {
                            participants: {
                                some: { userId: adminId },
                            },
                            AND: {
                                participants: {
                                    some: { userId: reporterId },
                                },
                            }
                        }
                    });

                    if (!convo) {
                        convo = await tx.conversation.create({
                            data: {
                                participants: {
                                    create: [{ userId: adminId }, { userId: reporterId }]
                                }
                            }
                        });
                    }

                    await tx.message.create({
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
        const { id } = req.params;
        const { reason } = req.body;
        await prisma.$transaction([
            prisma.user.update({ where: { id }, data: { isSuspended: true } }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'SUSPEND_USER',
                    targetEntityType: 'USER',
                    targetEntityId: id,
                    reason: reason || 'Manual suspension by admin'
                }
            })
        ]);
        res.json({ success: true, message: 'User suspended' });
    } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/unsuspend
const unsuspendUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.$transaction([
            prisma.user.update({ where: { id }, data: { isSuspended: false } }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'UNSUSPEND_USER',
                    targetEntityType: 'USER',
                    targetEntityId: id,
                    reason: 'Manual unsuspension by admin'
                }
            })
        ]);
        res.json({ success: true, message: 'User unsuspended' });
    } catch (err) { next(err); }
};

// GET /api/admin/logs — Admin: view audit trail
const getAdminLogs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [logs, total] = await Promise.all([
            prisma.adminActionLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    admin: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            email: true
                        }
                    }
                }
            }),
            prisma.adminActionLog.count()
        ]);

        res.json({ success: true, logs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

module.exports = { reportEntity, getReports, resolveReport, suspendUser, unsuspendUser, performModerationAction, getAdminLogs };
