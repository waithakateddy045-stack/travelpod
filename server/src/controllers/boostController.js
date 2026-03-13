const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/featured/boost — submit boost request
const submitBoost = async (req, res, next) => {
    try {
        const { postId, duration, targetAudience, targetRegion, tier } = req.body;
        if (!postId) throw new AppError('postId required', 400);

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post || post.userId !== req.user.id) throw new AppError('Post not found or not yours', 404);

        const boost = await prisma.boostRequest.create({
            data: {
                userId: req.user.id,
                postId,
                duration: duration || 1,
                targetAudience: targetAudience || null,
                targetRegion: targetRegion || null,
                tier: tier || 'BRONZE',
            },
        });

        res.status(201).json({ success: true, boost });
    } catch (err) { next(err); }
};

// GET /api/featured/my-boosts — user's boost history
const getMyBoosts = async (req, res, next) => {
    try {
        const boosts = await prisma.boostRequest.findMany({
            where: { userId: req.user.id },
            include: {
                post: { select: { id: true, title: true, thumbnailUrl: true, viewCount: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, boosts });
    } catch (err) { next(err); }
};

// GET /api/admin/boosts — all boost requests
const getAdminBoosts = async (req, res, next) => {
    try {
        const status = req.query.status || undefined;
        const where = status ? { status } : {};

        const boosts = await prisma.boostRequest.findMany({
            where,
            include: {
                user: { select: { id: true, displayName: true, username: true } },
                post: { select: { id: true, title: true, thumbnailUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, boosts });
    } catch (err) { next(err); }
};

// PATCH /api/admin/boosts/:id/approve
const approveBoost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const boost = await prisma.boostRequest.findUnique({ where: { id } });
        if (!boost) throw new AppError('Boost not found', 404);

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + boost.duration);

        const [updated] = await prisma.$transaction([
            prisma.boostRequest.update({
                where: { id },
                data: { status: 'ACTIVE', startDate, endDate },
            }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'APPROVE_BOOST',
                    targetEntityType: 'BOOST_REQUEST',
                    targetEntityId: id,
                    reason: `Boost approved for ${boost.duration} days`
                }
            })
        ]);

        res.json({ success: true, boost: updated });
    } catch (err) { next(err); }
};

// PATCH /api/admin/boosts/:id/reject
const rejectBoost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const [updated] = await prisma.$transaction([
            prisma.boostRequest.update({
                where: { id },
                data: { status: 'REJECTED', adminNotes: reason || 'Rejected by admin' },
            }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'REJECT_BOOST',
                    targetEntityType: 'BOOST_REQUEST',
                    targetEntityId: id,
                    reason: reason || 'Rejected'
                }
            })
        ]);

        res.json({ success: true, boost: updated });
    } catch (err) { next(err); }
};

// Get active boosts for feed injection (used internally by feedController)
async function getActiveBoosts(viewerAccountType, viewerRegion) {
    try {
        const now = new Date();
        const boosts = await prisma.boostRequest.findMany({
            where: {
                status: 'ACTIVE',
                startDate: { lte: now },
                endDate: { gte: now },
            },
            include: {
                post: {
                    include: {
                        user: {
                            select: {
                                id: true, accountType: true,
                                displayName: true, username: true, avatarUrl: true, isVerified: true
                            },
                        },
                    },
                },
            },
            take: 5,
        });

        // Track impression for each returned boost
        for (const b of boosts) {
            prisma.boostRequest.update({
                where: { id: b.id },
                data: { impressions: { increment: 1 } },
            }).catch(() => { });
        }

        return boosts;
    } catch {
        return [];
    }
}

module.exports = { submitBoost, getMyBoosts, getAdminBoosts, approveBoost, rejectBoost, getActiveBoosts };
