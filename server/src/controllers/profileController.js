const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// ============================================================
// Helper: Parse safely (handles seed scripts that inserted JSON strings)
// ============================================================
const safeParseArray = (val) => {
    if (!val) return [];
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return []; }
    }
    return Array.isArray(val) ? val : [];
};

// ============================================================
// GET /api/profile/:handle  — Public profile view
// ============================================================
const getProfileByHandle = async (req, res, next) => {
    try {
        const { handle } = req.params;
        const profile = await prisma.profile.findUnique({
            where: { handle },
            include: {
                user: { select: { id: true, accountType: true, isSuspended: true, isDeleted: true, createdAt: true } },
                businessProfile: true,
            },
        });

        if (!profile || profile.user.isDeleted || profile.user.isSuspended) {
            throw new AppError('Profile not found', 404);
        }

        // Count posts
        const postCount = await prisma.post.count({
            where: { userId: profile.userId, moderationStatus: 'APPROVED' },
        });

        // Check if requesting user follows this profile
        let isFollowing = false;
        if (req.user) {
            const follow = await prisma.follow.findUnique({
                where: { followerId_followingId: { followerId: req.user.id, followingId: profile.userId } },
            });
            isFollowing = !!follow;
        }

        res.json({
            success: true,
            profile: {
                id: profile.id,
                userId: profile.userId,
                displayName: profile.displayName,
                handle: profile.handle,
                avatarUrl: profile.avatarUrl,
                personalityTags: safeParseArray(profile.personalityTags),
                preferredRegions: safeParseArray(profile.preferredRegions),
                followerCount: profile.followerCount,
                followingCount: profile.followingCount,
                verifiedReviewCount: profile.verifiedReviewCount,
                accountType: profile.user.accountType,
                joinedAt: profile.user.createdAt,
                postCount,
                isFollowing,
                businessProfile: profile.businessProfile ? {
                    logoUrl: profile.businessProfile.logoUrl,
                    country: profile.businessProfile.country,
                    description: profile.businessProfile.description,
                    websiteUrl: profile.businessProfile.websiteUrl,
                    verificationStatus: profile.businessProfile.verificationStatus,
                    starRating: profile.businessProfile.starRating,
                    verifiedReviewCount: profile.businessProfile.verifiedReviewCount,
                    responseRate: profile.businessProfile.responseRate,
                    avgResponseTimeMinutes: profile.businessProfile.avgResponseTimeMinutes,
                } : null,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /api/profile/:handle/posts — Profile's posts
// ============================================================
const getProfilePosts = async (req, res, next) => {
    try {
        const { handle } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;

        const profile = await prisma.profile.findUnique({ where: { handle } });
        if (!profile) throw new AppError('Profile not found', 404);

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where: { userId: profile.userId, moderationStatus: 'APPROVED' },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true, title: true, thumbnailUrl: true, videoUrl: true,
                    duration: true, viewCount: true, likeCount: true, createdAt: true,
                    postType: true, isReview: true,
                },
            }),
            prisma.post.count({ where: { userId: profile.userId, moderationStatus: 'APPROVED' } }),
        ]);

        res.json({ success: true, posts, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /api/profile/:handle/reviews — Reviews received (business)
// ============================================================
const getProfileReviews = async (req, res, next) => {
    try {
        const { handle } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const profile = await prisma.profile.findUnique({ where: { handle } });
        if (!profile) throw new AppError('Profile not found', 404);

        const [reviews, total] = await Promise.all([
            prisma.videoReview.findMany({
                where: { businessId: profile.userId, moderationStatus: 'APPROVED' },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    post: { select: { id: true, title: true, thumbnailUrl: true, videoUrl: true, duration: true } },
                    reviewer: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                    reviewResponse: true,
                },
            }),
            prisma.videoReview.count({ where: { businessId: profile.userId, moderationStatus: 'APPROVED' } }),
        ]);

        res.json({ success: true, reviews, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// PUT /api/profile/me — Update own profile
// ============================================================
const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { displayName, handle, avatarUrl, personalityTags, preferredRegions, contentPreferences } = req.body;

        const safeTags = safeParseArray(personalityTags);
        const safeRegions = safeParseArray(preferredRegions);
        const safePrefs = safeParseArray(contentPreferences);

        const profile = await prisma.profile.update({
            where: { userId },
            data: {
                ...(displayName && { displayName }),
                ...(handle && { handle }),
                ...(avatarUrl && { avatarUrl }),
                ...(personalityTags && { personalityTags: safeTags }),
                ...(preferredRegions && { preferredRegions: safeRegions }),
                ...(contentPreferences && { contentPreferences: safePrefs }),
            },
        });

        res.json({ success: true, profile });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// PUT /api/profile/business — Update business details
// ============================================================
const updateBusinessProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { country, description, websiteUrl } = req.body;

        const profile = await prisma.profile.findUnique({ where: { userId } });
        if (!profile) throw new AppError('Profile not found', 404);

        const bp = await prisma.businessProfile.update({
            where: { profileId: profile.id },
            data: {
                ...(country !== undefined && { country }),
                ...(description !== undefined && { description }),
                ...(websiteUrl !== undefined && { websiteUrl }),
            },
        });

        res.json({ success: true, businessProfile: bp });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/profile/verification — Submit verification application
// ============================================================
const submitVerification = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { registrationDocUrl, licenceDocUrl, operatingAddress } = req.body;

        if (!registrationDocUrl || !operatingAddress) {
            throw new AppError('Registration document and operating address are required', 400);
        }

        const profile = await prisma.profile.findUnique({
            where: { userId },
            include: { businessProfile: true },
        });

        if (!profile?.businessProfile) {
            throw new AppError('Business profile required for verification', 400);
        }

        // Check for existing pending application
        const existing = await prisma.verificationApplication.findFirst({
            where: { businessProfileId: profile.businessProfile.id, status: 'PENDING' },
        });
        if (existing) {
            throw new AppError('You already have a pending verification application', 409);
        }

        const application = await prisma.verificationApplication.create({
            data: {
                businessProfileId: profile.businessProfile.id,
                registrationDocUrl,
                licenceDocUrl: licenceDocUrl || null,
                operatingAddress,
            },
        });

        res.status(201).json({ success: true, application });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /api/profile/verification/status — Check verification status
// ============================================================
const getVerificationStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const profile = await prisma.profile.findUnique({
            where: { userId },
            include: { businessProfile: true },
        });

        if (!profile?.businessProfile) {
            return res.json({ success: true, status: null, message: 'No business profile' });
        }

        const latestApp = await prisma.verificationApplication.findFirst({
            where: { businessProfileId: profile.businessProfile.id },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            verificationStatus: profile.businessProfile.verificationStatus,
            application: latestApp,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getProfileByHandle, getProfilePosts, getProfileReviews,
    updateMyProfile, updateBusinessProfile,
    submitVerification, getVerificationStatus,
};
