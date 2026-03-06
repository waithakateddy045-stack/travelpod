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
            prisma.verificationApplication.count({ where: { status: 'PENDING' } }),
            prisma.report.count(),
            prisma.user.count({ where: { isSuspended: true } }),
            prisma.post.count({ where: { moderationStatus: 'APPROVED' } }),
            prisma.tripBoard.count(),
            prisma.enquiry.count(),
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
                totalVerifications: pendingVerifications, // Keep backwards compatible
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
                    { profile: { displayName: { contains: search, mode: 'insensitive' } } },
                    { profile: { handle: { contains: search, mode: 'insensitive' } } },
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
                    accountType: true,
                    isSuspended: true,
                    emailVerified: true,
                    onboardingComplete: true,
                    createdAt: true,
                    profile: {
                        select: {
                            displayName: true,
                            handle: true,
                            avatarUrl: true,
                            followerCount: true,
                            businessProfile: {
                                select: {
                                    verificationStatus: true,
                                    starRating: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: { postsAuthored: true },
                    },
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

// GET /api/admin/verifications — Pending verification applications
const getVerifications = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || 'PENDING';

        const [apps, total] = await Promise.all([
            prisma.verificationApplication.findMany({
                where: { status },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    businessProfile: {
                        include: {
                            profile: {
                                select: {
                                    displayName: true,
                                    handle: true,
                                    avatarUrl: true,
                                    user: { select: { accountType: true, email: true } },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.verificationApplication.count({ where: { status } }),
        ]);

        res.json({ success: true, applications: apps, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// PUT /api/admin/verifications/:id — Approve or reject verification
const reviewVerification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { decision, reason } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            throw new AppError('Decision must be APPROVED or REJECTED', 400);
        }

        const app = await prisma.verificationApplication.update({
            where: { id },
            data: {
                status: decision,
                reviewedBy: req.user.id,
                reviewReason: reason || null,
                reviewedAt: new Date(),
            },
            include: { businessProfile: true },
        });

        await prisma.businessProfile.update({
            where: { id: app.businessProfileId },
            data: {
                verificationStatus: decision,
                verifiedAt: decision === 'APPROVED' ? new Date() : null,
            },
        });

        res.json({ success: true, application: app });
    } catch (err) { next(err); }
};

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
                            profile: {
                                select: {
                                    displayName: true,
                                    handle: true,
                                },
                            },
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

        await prisma.tripBoard.delete({
            where: { id },
        });

        res.json({ success: true, message: 'Trip Board deleted successfully' });
    } catch (err) { next(err); }
};

module.exports = { getDashboardStats, getUsers, getVerifications, reviewVerification, getBoards, deleteBoard };
