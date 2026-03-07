const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const getFollowersByUsername = async (req, res, next) => {
    try {
        const { username } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;

        // Find the user by handle safely
        const targetProfile = await prisma.profile.findFirst({
            where: { handle: { equals: username, mode: 'insensitive' } },
            select: { userId: true }
        });

        if (!targetProfile) {
            throw new AppError('User not found', 404);
        }

        const userId = targetProfile.userId;

        const [followers, total] = await Promise.all([
            prisma.follow.findMany({
                where: { followingId: userId },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    follower: {
                        select: {
                            id: true,
                            accountType: true,
                            profile: { select: { displayName: true, handle: true, avatarUrl: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.follow.count({ where: { followingId: userId } })
        ]);

        res.json({
            success: true,
            followers: followers.map(f => f.follower),
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        next(err);
    }
};

const getFollowingByUsername = async (req, res, next) => {
    try {
        const { username } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;

        const targetProfile = await prisma.profile.findFirst({
            where: { handle: { equals: username, mode: 'insensitive' } },
            select: { userId: true }
        });

        if (!targetProfile) {
            throw new AppError('User not found', 404);
        }

        const userId = targetProfile.userId;

        const [following, total] = await Promise.all([
            prisma.follow.findMany({
                where: { followerId: userId },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    following: {
                        select: {
                            id: true,
                            accountType: true,
                            profile: { select: { displayName: true, handle: true, avatarUrl: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.follow.count({ where: { followerId: userId } })
        ]);

        res.json({
            success: true,
            following: following.map(f => f.following),
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { getFollowersByUsername, getFollowingByUsername };
