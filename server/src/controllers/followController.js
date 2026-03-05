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

        await Promise.all([
            prisma.profile.updateMany({ where: { userId: followingId }, data: { followerCount: { increment: 1 } } }),
            prisma.profile.updateMany({ where: { userId: followerId }, data: { followingCount: { increment: 1 } } }),
        ]);

        const { createNotification } = require('./notificationController');
        createNotification({
            userId: followingId,
            type: 'new_follower',
            title: 'New Follower!',
            body: 'Someone just started following you.',
            relatedEntityId: followerId,
            relatedEntityType: 'user',
        }).catch(() => { });

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

const getFollowers = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;

        const [followers, total] = await Promise.all([
            prisma.follow.findMany({
                where: { followingId: userId },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    follower: {
                        select: {
                            id: true, accountType: true,
                            profile: { select: { displayName: true, handle: true, avatarUrl: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.follow.count({ where: { followingId: userId } })
        ]);

        res.json({ success: true, followers: followers.map(f => f.follower), total, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

const getFollowing = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;

        const [following, total] = await Promise.all([
            prisma.follow.findMany({
                where: { followerId: userId },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    following: {
                        select: {
                            id: true, accountType: true,
                            profile: { select: { displayName: true, handle: true, avatarUrl: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.follow.count({ where: { followerId: userId } })
        ]);

        res.json({ success: true, following: following.map(f => f.following), total, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

module.exports = { followUser, unfollowUser, getFollowers, getFollowing };
