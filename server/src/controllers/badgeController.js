const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const BADGE_MILESTONES = [
    { key: 'first_post', label: 'First Post', description: 'Upload your first video', icon: '🎬', check: async (userId) => (await prisma.post.count({ where: { userId } })) >= 1 },
    { key: 'ten_posts', label: '10 Posts', description: 'Upload 10 videos', icon: '📹', check: async (userId) => (await prisma.post.count({ where: { userId } })) >= 10 },
    { key: 'first_review', label: 'First Review', description: 'Write your first review', icon: '⭐', check: async (userId) => (await prisma.videoReview.count({ where: { reviewerId: userId } })) >= 1 },
    { key: 'hundred_followers', label: '100 Followers', description: 'Reach 100 followers', icon: '👥', check: async (userId) => { const p = await prisma.profile.findUnique({ where: { userId } }); return (p?.followerCount || 0) >= 100; } },
    { key: 'thousand_views', label: '1K Views', description: 'Get 1,000 total views', icon: '👀', check: async (userId) => { const r = await prisma.post.aggregate({ where: { userId }, _sum: { viewCount: true } }); return (r._sum.viewCount || 0) >= 1000; } },
    { key: 'verified_business', label: 'Verified', description: 'Get your business verified', icon: '✅', check: async (userId) => { const bp = await prisma.businessProfile.findFirst({ where: { profile: { userId } } }); return bp?.verificationStatus === 'APPROVED'; } },
];

// GET /api/badges — Get user badges
const getUserBadges = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const existing = await prisma.badge.findMany({ where: { userId } });
        const earnedKeys = new Set(existing.map(b => b.badgeKey));

        // Check for new badges
        for (const milestone of BADGE_MILESTONES) {
            if (!earnedKeys.has(milestone.key)) {
                const earned = await milestone.check(userId);
                if (earned) {
                    await prisma.badge.create({ data: { userId, badgeKey: milestone.key, badgeLabel: milestone.label } });
                    earnedKeys.add(milestone.key);
                }
            }
        }

        const badges = BADGE_MILESTONES.map(m => ({
            key: m.key, label: m.label, description: m.description,
            icon: m.icon, earned: earnedKeys.has(m.key),
        }));

        res.json({ success: true, badges });
    } catch (err) { next(err); }
};

module.exports = { getUserBadges };
