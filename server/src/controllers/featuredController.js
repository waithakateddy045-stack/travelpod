const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/featured — Create a featured placement (admin)
const createFeatured = async (req, res, next) => {
    try {
        const { postId, profileId, section, startDate, endDate, priority } = req.body;
        if (!section) throw new AppError('Section is required', 400);

        const featured = await prisma.featuredPlacement.create({
            data: {
                postId: postId || null,
                profileId: profileId || null,
                section,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                priority: priority || 0,
                createdById: req.user.id,
            },
        });
        res.status(201).json({ success: true, featured });
    } catch (err) { next(err); }
};

// GET /api/featured?section=...
const getFeatured = async (req, res, next) => {
    try {
        const { section } = req.query;
        const now = new Date();
        const featured = await prisma.featuredPlacement.findMany({
            where: {
                isActive: true,
                ...(section && { section }),
                startDate: { lte: now },
                OR: [{ endDate: null }, { endDate: { gte: now } }],
            },
            orderBy: { priority: 'desc' },
            include: {
                post: { select: { id: true, title: true, thumbnailUrl: true, videoUrl: true, user: { select: { profile: { select: { displayName: true, handle: true } } } } } },
                profile: { select: { displayName: true, handle: true, avatarUrl: true } },
            },
        });
        res.json({ success: true, featured });
    } catch (err) { next(err); }
};

module.exports = { createFeatured, getFeatured };
