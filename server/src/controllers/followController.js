const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const followUser = async (req, res, next) => {
    try {
        const followerId = req.user.id;
        const followingId = req.params.userId;

        if (followerId === followingId) throw new AppError('Cannot follow yourself', 400);

        const existing = await prisma.follow.findUnique({
            where: { followerId_followingId: { followerId, followingId } },
        });
        if (existing) return res.json({ success: true, message: 'Already following' });

        await prisma.follow.create({ data: { followerId, followingId } });

        // Update counts
        await Promise.all([
            prisma.profile.updateMany({ where: { userId: followingId }, data: { followerCount: { increment: 1 } } }),
            prisma.profile.updateMany({ where: { userId: followerId }, data: { followingCount: { increment: 1 } } }),
        ]);

        res.status(201).json({ success: true, message: 'Followed' });
    } catch (err) { next(err); }
};

const unfollowUser = async (req, res, next) => {
    try {
        const followerId = req.user.id;
        const followingId = req.params.userId;

        await prisma.follow.delete({
            where: { followerId_followingId: { followerId, followingId } },
        }).catch(() => { });

        await Promise.all([
            prisma.profile.updateMany({ where: { userId: followingId }, data: { followerCount: { decrement: 1 } } }),
            prisma.profile.updateMany({ where: { userId: followerId }, data: { followingCount: { decrement: 1 } } }),
        ]);

        res.json({ success: true, message: 'Unfollowed' });
    } catch (err) { next(err); }
};

module.exports = { followUser, unfollowUser };
