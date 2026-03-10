const prisma = require('../utils/prisma');

// POST /api/analytics/event — Track an analytics event
const trackEvent = async (req, res, next) => {
    try {
        // PRD v3 schema does not include AnalyticsEvent; ignore safely.
        res.json({ success: true });
    } catch (err) { next(err); }
};

// GET /api/analytics/dashboard — Business analytics
const getDashboard = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [totalPosts, totalViews, totalLikes, me] = await Promise.all([
            prisma.post.count({ where: { userId, moderationStatus: 'APPROVED' } }),
            prisma.post.aggregate({ where: { userId }, _sum: { viewCount: true } }),
            prisma.post.aggregate({ where: { userId }, _sum: { likeCount: true } }),
            prisma.user.findUnique({ where: { id: userId }, select: { followerCount: true } }),
        ]);

        res.json({
            success: true,
            dashboard: {
                totalPosts,
                totalViews: totalViews._sum.viewCount || 0,
                totalLikes: totalLikes._sum.likeCount || 0,
                totalFollowers: me?.followerCount || 0,
                last30DaysEvents: [],
            },
        });
    } catch (err) { next(err); }
};

module.exports = { trackEvent, getDashboard };
