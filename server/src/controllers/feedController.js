const prisma = require('../utils/prisma');

// ============================================================
// GET /api/feed — Personalized feed
// ============================================================
const getFeed = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.user?.id;

        // Get IDs of users the current user follows
        let followingIds = [];
        if (userId) {
            const follows = await prisma.follow.findMany({
                where: { followerId: userId },
                select: { followingId: true },
            });
            followingIds = follows.map(f => f.followingId);
        }

        // Build feed — APPROVED posts only, newest first
        const posts = await prisma.post.findMany({
            where: { moderationStatus: 'APPROVED' },
            orderBy: [{ createdAt: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
            include: {
                author: {
                    select: {
                        id: true,
                        accountType: true,
                        profile: { select: { displayName: true, handle: true, avatarUrl: true } },
                    },
                },
                category: true,
                postTags: { include: { tag: true } },
            },
        });

        // Attach like/save status for authenticated users
        let enrichedPosts = posts.map(p => ({ ...p, user: p.author }));
        if (userId) {
            const postIds = posts.map(p => p.id);
            const [likes, saves] = await Promise.all([
                prisma.like.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
                prisma.save.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
            ]);
            const likedSet = new Set(likes.map(l => l.postId));
            const savedSet = new Set(saves.map(s => s.postId));
            enrichedPosts = posts.map(p => ({
                ...p,
                user: p.author,
                isLiked: likedSet.has(p.id),
                isSaved: savedSet.has(p.id),
                isFollowed: followingIds.includes(p.userId),
            }));
        }

        const total = await prisma.post.count({ where: { moderationStatus: 'APPROVED' } });

        res.json({
            success: true,
            posts: enrichedPosts,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { getFeed };
