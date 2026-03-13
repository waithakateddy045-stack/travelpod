const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// GET /api/admin/stats — Dashboard overview
const getDashboardStats = async (req, res, next) => {
    try {
        const [
            totalUsers,
            totalPosts,
            pendingPosts,
            pendingVerifications,
            totalReports,
            suspendedUsers,
            approvedPosts,
            totalBoards,
            totalEnquiries,
        ] = await Promise.all([
            prisma.user.count({ where: { accountType: { not: 'ADMIN' } } }),
            prisma.post.count(),
            prisma.post.count({ where: { moderationStatus: 'PENDING' } }),
            prisma.businessVerification.count({ where: { status: 'PENDING' } }),
            prisma.report.count(),
            prisma.user.count({ where: { isSuspended: true } }),
            prisma.post.count({ where: { moderationStatus: 'APPROVED' } }),
            prisma.tripBoard.count(),
            prisma.bookingEnquiry.count(),
        ]);

        const accountBreakdown = await prisma.user.groupBy({
            by: ['accountType'],
            where: { accountType: { not: 'ADMIN' } },
            _count: { id: true },
        });

        // Recent posts (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentPosts = await prisma.post.count({
            where: { createdAt: { gte: weekAgo } },
        });

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalPosts,
                pendingPosts,
                pendingVerifications,
                totalReports,
                suspendedUsers,
                recentPosts,
                totalBoards,
                totalEnquiries,
                accountBreakdown: accountBreakdown.map(b => ({
                    type: b.accountType,
                    count: b._count.id,
                })),
            },
        });
    } catch (err) { next(err); }
};

// GET /api/admin/users — Paginated user list
const getUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const accountType = req.query.accountType || undefined;
        const status = req.query.status;

        const where = {
            accountType: { not: 'ADMIN' },
            ...(accountType && { accountType }),
            ...(status === 'suspended' && { isSuspended: true }),
            ...(status === 'active' && { isSuspended: false }),
            ...(search && {
                OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } },
                    { displayName: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    accountType: true,
                    isSuspended: true,
                    onboardingComplete: true,
                    isVerified: true,
                    createdAt: true,
                    followerCount: true,
                    followingCount: true,
                    totalLikes: true,
                    _count: { select: { posts: true } },
                },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            success: true,
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) { next(err); }
};

// Legacy Verification handlers removed. 
// Unified flow is now in verificationController.js

// GET /api/admin/boards — List all trip boards
const getBoards = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [boards, total] = await Promise.all([
            prisma.tripBoard.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true,
                            accountType: true,
                            isVerified: true,
                        },
                    },
                    _count: {
                        select: {
                            videos: true,
                        },
                    },
                },
            }),
            prisma.tripBoard.count(),
        ]);

        res.json({ success: true, boards, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// DELETE /api/admin/boards/:id — Delete a trip board
const deleteBoard = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.$transaction([
            prisma.tripBoard.delete({ where: { id } }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'DELETE_BOARD',
                    targetEntityType: 'TRIP_BOARD',
                    targetEntityId: id,
                    reason: 'Board deleted by admin'
                }
            })
        ]);

        res.json({ success: true, message: 'Trip Board deleted successfully' });
    } catch (err) { next(err); }
};

// PUT /api/admin/boards/:id — Update board status (moderation)
const updateBoardStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        const modStatus = action === 'RESTORED' ? 'APPROVED' : 'REJECTED';
        const makePublic = action === 'RESTORED';

        const [board] = await prisma.$transaction([
            prisma.tripBoard.update({
                where: { id },
                data: { 
                    moderationStatus: modStatus,
                    isPublic: makePublic 
                },
            }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: action === 'RESTORED' ? 'RESTORE_BOARD' : 'TAKE_DOWN_BOARD',
                    targetEntityType: 'TRIP_BOARD',
                    targetEntityId: id,
                    reason: action === 'RESTORED' ? 'Board restored' : 'Board taken down'
                }
            })
        ]);

        res.json({ success: true, board });
    } catch (err) { next(err); }
};

module.exports = { getDashboardStats, getUsers, getBoards, deleteBoard, updateBoardStatus };
