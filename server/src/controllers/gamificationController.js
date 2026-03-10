const prisma = require('../utils/prisma');

// GET /api/badges/all — all available badges
const getAllBadges = async (req, res, next) => {
    try {
        const badges = await prisma.badge.findMany({
            orderBy: { tier: 'asc' },
        });
        res.json({ success: true, badges });
    } catch (err) { next(err); }
};

// GET /api/badges/my — current user's earned badges
const getMyBadges = async (req, res, next) => {
    try {
        const earned = await prisma.userBadge.findMany({
            where: { userId: req.user.id },
            include: { badge: true },
            orderBy: { earnedAt: 'desc' },
        });
        res.json({ success: true, badges: earned });
    } catch (err) { next(err); }
};

// GET /api/users/:username/badges — public badge display
const getUserBadges = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { username: req.params.username },
            select: { id: true },
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const earned = await prisma.userBadge.findMany({
            where: { userId: user.id },
            include: { badge: true },
            orderBy: { earnedAt: 'desc' },
        });
        res.json({ success: true, badges: earned });
    } catch (err) { next(err); }
};

/**
 * Check and auto-award badges after an action
 * Called internally after: upload, like received, follow
 */
async function checkAndAwardBadges(userId) {
    try {
        const badges = await prisma.badge.findMany();
        const existing = await prisma.userBadge.findMany({
            where: { userId },
            select: { badgeId: true },
        });
        const earnedSet = new Set(existing.map(e => e.badgeId));

        const [postCount, totalLikes, followingCount] = await Promise.all([
            prisma.post.count({ where: { userId } }),
            prisma.post.aggregate({ where: { userId }, _sum: { likeCount: true } }),
            prisma.follow.count({ where: { followerId: userId } }),
        ]);

        const likesTotal = totalLikes._sum.likeCount || 0;

        // Check location-based badges
        const africaPosts = await prisma.post.count({
            where: {
                userId,
                locationTag: { contains: 'Kenya', mode: 'insensitive' },
            },
        }).catch(() => 0);

        const beachPosts = await prisma.post.count({
            where: {
                userId,
                OR: [
                    { locationTag: { contains: 'beach', mode: 'insensitive' } },
                    { title: { contains: 'beach', mode: 'insensitive' } },
                ],
            },
        }).catch(() => 0);

        const isVerified = await prisma.businessVerification.findFirst({
            where: { userId, status: 'APPROVED' },
        }).catch(() => null);

        const newlyEarned = [];

        for (const badge of badges) {
            if (earnedSet.has(badge.id)) continue;

            const criteria = badge.criteria || {};
            let qualified = false;

            switch (criteria.type) {
                case 'posts_count':
                    qualified = postCount >= (criteria.threshold || 1);
                    break;
                case 'likes_total':
                    qualified = likesTotal >= (criteria.threshold || 100);
                    break;
                case 'following_count':
                    qualified = followingCount >= (criteria.threshold || 50);
                    break;
                case 'africa_posts':
                    qualified = africaPosts >= (criteria.threshold || 5);
                    break;
                case 'beach_posts':
                    qualified = beachPosts >= (criteria.threshold || 5);
                    break;
                case 'verified':
                    qualified = !!isVerified;
                    break;
                default:
                    break;
            }

            if (qualified) {
                await prisma.userBadge.create({
                    data: { userId, badgeId: badge.id },
                }).catch(() => {}); // Ignore duplicate
                newlyEarned.push(badge);
            }
        }

        return newlyEarned;
    } catch (err) {
        console.error('Badge check error:', err.message);
        return [];
    }
}

module.exports = { getAllBadges, getMyBadges, getUserBadges, checkAndAwardBadges };
