const prisma = require('../utils/prisma');

// POST /api/analytics/event — Track an analytics event
const trackEvent = async (req, res, next) => {
    try {
        const { eventType, postId, metadata, sessionId } = req.body;
        await prisma.analyticsEvent.create({
            data: {
                userId: req.user?.id || null,
                sessionId: sessionId || null,
                eventType,
                entityId: postId || null,
                entityType: postId ? 'POST' : null,
                metadataJson: metadata || {},
                // ipAddress: req.ip, // (Prisma model doesn't have it, omitting to avoid error)
                // userAgent: req.headers['user-agent'],
            },
        });
        res.json({ success: true });
    } catch (err) { next(err); }
};

// GET /api/analytics/dashboard — Business analytics
const getDashboard = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [totalPosts, totalViews, totalLikes, totalFollowers, recentEvents] = await Promise.all([
            prisma.post.count({ where: { userId, moderationStatus: 'APPROVED' } }),
            prisma.post.aggregate({ where: { userId }, _sum: { viewCount: true } }),
            prisma.post.aggregate({ where: { userId }, _sum: { likeCount: true } }),
            prisma.profile.findUnique({ where: { userId }, select: { followerCount: true } }),
            prisma.analyticsEvent.groupBy({
                by: ['eventType'],
                where: { entityId: { in: (await prisma.post.findMany({ where: { userId }, select: { id: true } })).map(p => p.id) }, createdAt: { gte: thirtyDaysAgo } },
                _count: true,
            }),
        ]);

        res.json({
            success: true,
            dashboard: {
                totalPosts,
                totalViews: totalViews._sum.viewCount || 0,
                totalLikes: totalLikes._sum.likeCount || 0,
                totalFollowers: totalFollowers?.followerCount || 0,
                last30DaysEvents: recentEvents,
            },
        });
    } catch (err) { next(err); }
};

module.exports = { trackEvent, getDashboard };
