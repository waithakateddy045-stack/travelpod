const prisma = require('../utils/prisma');

// GET /api/search?q=...&type=...
const search = async (req, res, next) => {
    try {
        const { q, type } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        if (!q?.trim()) return res.json({ success: true, results: [], total: 0 });

        const query = q.trim();
        let results = [];
        let total = 0;

        if (!type || type === 'users') {
            const [profiles, count] = await Promise.all([
                prisma.profile.findMany({
                    where: {
                        OR: [
                            { displayName: { contains: query, mode: 'insensitive' } },
                            { handle: { contains: query, mode: 'insensitive' } },
                        ],
                    },
                    skip: (page - 1) * limit, take: limit,
                    select: {
                        displayName: true, handle: true, avatarUrl: true,
                        followerCount: true, user: { select: { accountType: true } },
                        businessProfile: { select: { verificationStatus: true, starRating: true } },
                    },
                }),
                prisma.profile.count({
                    where: {
                        OR: [
                            { displayName: { contains: query, mode: 'insensitive' } },
                            { handle: { contains: query, mode: 'insensitive' } },
                        ]
                    },
                }),
            ]);
            results = profiles.map(p => ({ ...p, resultType: 'user' }));
            total = count;
        }

        if (type === 'posts') {
            const [posts, count] = await Promise.all([
                prisma.post.findMany({
                    where: {
                        moderationStatus: 'APPROVED',
                        OR: [
                            { title: { contains: query, mode: 'insensitive' } },
                            { description: { contains: query, mode: 'insensitive' } },
                            { locationTag: { contains: query, mode: 'insensitive' } },
                        ],
                    },
                    skip: (page - 1) * limit, take: limit,
                    select: {
                        id: true, title: true, thumbnailUrl: true, viewCount: true,
                        likeCount: true, categoryId: true, locationTag: true, createdAt: true,
                        author: { select: { profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                    },
                }),
                prisma.post.count({
                    where: {
                        moderationStatus: 'APPROVED', OR: [
                            { title: { contains: query, mode: 'insensitive' } },
                            { description: { contains: query, mode: 'insensitive' } },
                            { locationTag: { contains: query, mode: 'insensitive' } },
                        ]
                    },
                }),
            ]);
            results = posts.map(p => ({ ...p, category: p.categoryId, location: p.locationTag, user: p.author, resultType: 'post' }));
            total = count;
        }

        res.json({ success: true, results, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// GET /api/search/categories — Top categories
const getCategories = async (req, res, next) => {
    try {
        const categories = await prisma.post.groupBy({
            by: ['categoryId'],
            where: { moderationStatus: 'APPROVED', categoryId: { not: null } },
            _count: true,
            orderBy: { _count: { categoryId: 'desc' } },
            take: 20,
        });
        res.json({ success: true, categories: categories.map(c => ({ category: c.categoryId, _count: c._count })) });
    } catch (err) { next(err); }
};

// GET /api/search/top-rated — Top rated businesses
const getTopRated = async (req, res, next) => {
    try {
        const businesses = await prisma.businessProfile.findMany({
            where: { verificationStatus: 'APPROVED', starRating: { gt: 0 } },
            orderBy: { starRating: 'desc' },
            take: 20,
            include: { profile: { select: { displayName: true, handle: true, avatarUrl: true } } },
        });
        res.json({ success: true, businesses });
    } catch (err) { next(err); }
};

module.exports = { search, getCategories, getTopRated };
