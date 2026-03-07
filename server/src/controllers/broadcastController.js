const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// ============================================================
// Broadcast System — Uses BroadcastPost + BroadcastTarget models
// ============================================================

// POST /api/broadcasts — Admin or Association creates a broadcast
const createBroadcast = async (req, res, next) => {
    try {
        const senderType = req.user.accountType;
        if (senderType !== 'ASSOCIATION' && senderType !== 'ADMIN') {
            throw new AppError('Only associations and admins can create broadcasts', 403);
        }

        const { postId, title, message, sectorTargeting, region } = req.body;
        if (!title || !message) throw new AppError('Title and message are required', 400);

        // If postId provided, link to existing post; otherwise create a broadcast-type post
        let targetPostId = postId;
        if (!targetPostId) {
            const post = await prisma.post.create({
                data: {
                    userId: req.user.id,
                    title: title.trim(),
                    description: message.trim(),
                    videoUrl: '',
                    duration: 0,
                    postType: 'BROADCAST',
                    moderationStatus: 'APPROVED',
                },
            });
            targetPostId = post.id;
        }

        const targeting = sectorTargeting || [];

        // Create the broadcast post
        const broadcast = await prisma.broadcastPost.create({
            data: {
                postId: targetPostId,
                associationId: req.user.id,
                sectorTargeting: targeting,
            },
        });

        // Auto-resolve targets based on sector targeting
        const targetWhere = {};
        if (targeting.length > 0) {
            targetWhere.accountType = { in: targeting };
        }
        if (region) {
            targetWhere.profile = { businessProfile: { country: { contains: region, mode: 'insensitive' } } };
        }

        const targetUsers = await prisma.user.findMany({
            where: {
                ...targetWhere,
                isSuspended: false,
                isDeleted: false,
                id: { not: req.user.id },
            },
            select: { id: true },
            take: 10000,
        });

        // Create broadcast targets in batch
        if (targetUsers.length > 0) {
            await prisma.broadcastTarget.createMany({
                data: targetUsers.map(u => ({
                    broadcastId: broadcast.id,
                    targetUserId: u.id,
                })),
                skipDuplicates: true,
            });

            await prisma.broadcastPost.update({
                where: { id: broadcast.id },
                data: { reachCount: targetUsers.length },
            });
        }

        res.status(201).json({
            success: true,
            broadcast: { ...broadcast, targetCount: targetUsers.length },
        });
    } catch (err) { next(err); }
};

// GET /api/broadcasts — Admin: list all broadcasts with stats
const getBroadcasts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [broadcasts, total] = await Promise.all([
            prisma.broadcastPost.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    post: {
                        select: { id: true, title: true, description: true, videoUrl: true, thumbnailUrl: true, duration: true, postType: true },
                    },
                    association: {
                        select: {
                            profile: { select: { displayName: true, handle: true, avatarUrl: true } },
                        },
                    },
                    _count: { select: { targets: true } },
                },
            }),
            prisma.broadcastPost.count(),
        ]);

        // Enrich with viewed counts
        const enriched = await Promise.all(broadcasts.map(async (b) => {
            const viewedCount = await prisma.broadcastTarget.count({
                where: { broadcastId: b.id, viewed: true },
            });
            return {
                ...b,
                targetCount: b._count.targets,
                viewedCount,
                viewRate: b._count.targets > 0 ? ((viewedCount / b._count.targets) * 100).toFixed(1) : '0',
            };
        }));

        res.json({ success: true, broadcasts: enriched, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// GET /api/broadcasts/inbox — User: broadcasts targeted at them
const getBroadcastsForUser = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const targets = await prisma.broadcastTarget.findMany({
            where: { targetUserId: req.user.id },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                broadcast: {
                    include: {
                        post: {
                            select: { id: true, title: true, description: true, videoUrl: true, thumbnailUrl: true, duration: true, postType: true },
                        },
                        association: {
                            select: {
                                profile: { select: { displayName: true, handle: true, avatarUrl: true } },
                            },
                        },
                    },
                },
            },
        });

        const broadcasts = targets.map(t => ({
            id: t.broadcast.id,
            post: t.broadcast.post,
            sender: t.broadcast.association,
            viewed: t.viewed,
            delivered: t.delivered,
            targetId: t.id,
            createdAt: t.createdAt,
        }));

        res.json({ success: true, broadcasts, page });
    } catch (err) { next(err); }
};

// PUT /api/broadcasts/:id/viewed — Mark as viewed
const markBroadcastViewed = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.broadcastTarget.updateMany({
            where: {
                broadcastId: id,
                targetUserId: req.user.id,
            },
            data: { viewed: true, delivered: true },
        });

        // Increment view count on the broadcast post
        await prisma.broadcastPost.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });

        res.json({ success: true });
    } catch (err) { next(err); }
};

// DELETE /api/admin/broadcasts/:id — Delete a broadcast
const deleteBroadcast = async (req, res, next) => {
    try {
        await prisma.broadcastPost.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) { next(err); }
};

module.exports = { createBroadcast, getBroadcasts, getBroadcastsForUser, markBroadcastViewed, deleteBroadcast };
