const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// ============================================================
// Promoted Posts / Featured Placements Controller
// ============================================================

// POST /api/admin/promotions — Create a new promotion
const createPromotion = async (req, res, next) => {
    try {
        const { postId, startAt, endAt, targetingCriteria, dailyReachTarget } = req.body;

        if (!postId || !startAt || !endAt) {
            throw new AppError('postId, startAt, and endAt are required', 400);
        }

        // Verify postId exists
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) throw new AppError('Post not found', 404);

        const promotion = await prisma.featuredPlacement.create({
            data: {
                postId,
                businessId: post.userId,
                startAt: new Date(startAt),
                endAt: new Date(endAt),
                targetingCriteria: targetingCriteria || {},
                dailyReachTarget: dailyReachTarget || 1000,
                status: 'ACTIVE',
            },
            include: {
                post: {
                    select: {
                        id: true, title: true, thumbnailUrl: true, viewCount: true,
                        user: { select: { displayName: true, username: true } },
                    },
                },
            },
        });

        // 3. Log the action
        await prisma.adminActionLog.create({
            data: {
                adminId: req.user.id,
                actionType: 'CREATE_PROMOTION',
                targetEntityType: 'POST',
                targetEntityId: postId,
                reason: `Promoted post: ${post.title}`,
                details: { promotionId: promotion.id, dailyReachTarget }
            }
        });

        res.status(201).json({ success: true, promotion });
    } catch (err) { next(err); }
};

// GET /api/admin/promotions — List all promotions
const getPromotions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || null;

        const where = {};
        if (status) where.status = status;

        const [promotions, total] = await Promise.all([
            prisma.featuredPlacement.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    post: {
                        select: {
                            id: true, title: true, thumbnailUrl: true, viewCount: true, likeCount: true,
                            user: { select: { displayName: true, username: true, avatarUrl: true } },
                        },
                    },
                    business: {
                        select: { displayName: true, username: true },
                    },
                },
            }),
            prisma.featuredPlacement.count({ where }),
        ]);

        res.json({ success: true, promotions, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// PUT /api/admin/promotions/:id — Update promotion (pause/resume/end)
const updatePromotion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, endAt, dailyReachTarget, targetingCriteria } = req.body;

        const data = {};
        if (status) data.status = status;
        if (endAt) data.endAt = new Date(endAt);
        if (dailyReachTarget) data.dailyReachTarget = dailyReachTarget;
        if (targetingCriteria) data.targetingCriteria = targetingCriteria;

        const promotion = await prisma.featuredPlacement.update({
            where: { id },
            data,
            include: {
                post: {
                    select: { id: true, title: true, thumbnailUrl: true },
                },
            },
        });

        // Log the action
        await prisma.adminActionLog.create({
            data: {
                adminId: req.user.id,
                actionType: 'UPDATE_PROMOTION',
                targetEntityType: 'PROMOTION',
                targetEntityId: id,
                reason: `Status changed to ${status || 'updated'}`,
                details: data
            }
        });

        res.json({ success: true, promotion });
    } catch (err) { next(err); }
};

// DELETE /api/admin/promotions/:id — Remove a promotion
const deletePromotion = async (req, res, next) => {
    try {
        await prisma.$transaction([
            prisma.featuredPlacement.delete({ where: { id: req.params.id } }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'DELETE_PROMOTION',
                    targetEntityType: 'PROMOTION',
                    targetEntityId: req.params.id,
                    reason: 'Promotion deleted by admin'
                }
            })
        ]);
        res.json({ success: true });
    } catch (err) { next(err); }
};

// POST /api/feed/impression — Track a promoted post impression
const recordImpression = async (req, res, next) => {
    try {
        const { promotionId } = req.body;
        if (!promotionId) throw new AppError('promotionId required', 400);

        await prisma.featuredPlacement.update({
            where: { id: promotionId },
            data: { impressions: { increment: 1 } },
        });

        // Also track profile visit if applicable
        if (req.body.type === 'PROFILE_VISIT') {
            await prisma.featuredPlacement.update({
                where: { id: promotionId },
                data: { profileVisits: { increment: 1 } },
            });
        }

        res.json({ success: true });
    } catch (err) { next(err); }
};

module.exports = { createPromotion, getPromotions, updatePromotion, deletePromotion, recordImpression };
