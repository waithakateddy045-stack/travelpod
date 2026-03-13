const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  websiteUrl: true,
  accountType: true,
  isVerified: true,
  followerCount: true,
  followingCount: true,
  totalLikes: true,
  personalityTags: true,
  preferredRegions: true,
  parentAccountId: true,
  isManagedBusinessPage: true,
  createdAt: true,
};

// GET /api/profile/:handle — handle is username
const getProfileByHandle = async (req, res, next) => {
  try {
    const { handle } = req.params;
    const user = await prisma.user.findUnique({
      where: { username: handle },
      select: publicUserSelect,
    });
    if (!user || user.isSuspended) throw new AppError('Profile not found', 404);

    const isOwner = req.user && req.user.id === user.id;
    const postCount = await prisma.post.count({
      where: { userId: user.id, moderationStatus: isOwner ? { in: ['APPROVED', 'PENDING'] } : 'APPROVED' },
    });

    let isFollowing = false;
    if (req.user) {
      const follow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.user.id, followingId: user.id } },
      });
      isFollowing = !!follow;
    }

    const verification = await prisma.businessVerification.findUnique({
      where: { userId: user.id },
    }).catch(() => null);

    res.json({
      success: true,
      profile: {
        ...user,
        userId: user.id,
        handle: user.username,
        personalityTags: user.personalityTags || [],
        preferredRegions: user.preferredRegions || [],
        postCount,
        isFollowing,
        verification,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/profile/:handle/posts
const getProfilePosts = async (req, res, next) => {
  try {
    const { handle } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 60);

    const user = await prisma.user.findUnique({ where: { username: handle }, select: { id: true } });
    if (!user) throw new AppError('Profile not found', 404);

    const isOwner = req.user && req.user.id === user.id;
    const moderationFilter = isOwner ? { in: ['APPROVED', 'PENDING'] } : 'APPROVED';

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { userId: user.id, moderationStatus: moderationFilter },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          videoUrl: true,
          duration: true,
          viewCount: true,
          likeCount: true,
          createdAt: true,
          postType: true,
          isReview: true,
          textContent: true,
          mediaUrls: true,
        },
      }),
      prisma.post.count({ where: { userId: user.id, moderationStatus: 'APPROVED' } }),
    ]);

    const mappedPosts = posts.map(p => ({
      ...p,
      author: p.author ? {
        ...p.author,
        profile: {
          handle: p.author.username,
          displayName: p.author.displayName,
          avatarUrl: p.author.avatarUrl
        }
      } : {
        // Fallback for profile-owner posts where author is the page owner
        profile: {
          handle: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        }
      }
    }));

    res.json({ success: true, posts: mappedPosts, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/profile/:handle/reviews — reviews as Posts with isReview=true
const getProfileReviews = async (req, res, next) => {
  try {
    const { handle } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const user = await prisma.user.findUnique({ where: { username: handle }, select: { id: true } });
    if (!user) throw new AppError('Profile not found', 404);

    const [reviews, total] = await Promise.all([
      prisma.post.findMany({
        where: { userId: user.id, isReview: true, moderationStatus: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where: { userId: user.id, isReview: true, moderationStatus: 'APPROVED' } }),
    ]);

    res.json({ success: true, reviews, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/profile/me — update User fields
const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { displayName, username, avatarUrl, bio, websiteUrl, personalityTags, preferredRegions } = req.body;

    const data = {};
    if (displayName !== undefined) data.displayName = displayName;
    if (username !== undefined) data.username = username;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (bio !== undefined) data.bio = bio;
    if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
    if (personalityTags !== undefined) data.personalityTags = Array.isArray(personalityTags) ? personalityTags : [];
    if (preferredRegions !== undefined) data.preferredRegions = Array.isArray(preferredRegions) ? preferredRegions : [];

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    });

    res.json({ success: true, profile: user });
  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('username')) {
      return next(new AppError('Username is already taken', 409));
    }
    next(err);
  }
};

// PUT /api/profile/business — basic business fields on User
const updateBusinessProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { websiteUrl, bio } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(bio !== undefined && { bio }),
      },
      select: publicUserSelect,
    });

    res.json({ success: true, profile: user });
  } catch (err) {
    next(err);
  }
};

// POST /api/profile/verification — apply for BusinessVerification
const submitVerification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      businessRegistrationNumber,
      businessRegistrationDocument,
      registeredWebsite,
      contactEmail,
      contactPhone,
      physicalAddress,
      associationName,
      associationMembershipNumber,
      associationDocument,
      associationListingUrl,
    } = req.body;

    if (!businessRegistrationNumber || !businessRegistrationDocument || !registeredWebsite || !contactEmail) {
      throw new AppError('Missing required verification fields', 400);
    }

    const existing = await prisma.businessVerification.findUnique({ where: { userId } });
    if (existing && existing.status === 'PENDING') {
      throw new AppError('You already have a pending verification application', 409);
    }

    const verification = await prisma.businessVerification.upsert({
      where: { userId },
      update: {
        businessRegistrationNumber,
        businessRegistrationDocument,
        registeredWebsite,
        contactEmail,
        contactPhone: contactPhone || null,
        physicalAddress: physicalAddress || null,
        associationName: associationName || null,
        associationMembershipNumber: associationMembershipNumber || null,
        associationDocument: associationDocument || null,
        associationListingUrl: associationListingUrl || null,
        status: 'PENDING',
      },
      create: {
        userId,
        businessRegistrationNumber,
        businessRegistrationDocument,
        registeredWebsite,
        contactEmail,
        contactPhone: contactPhone || null,
        physicalAddress: physicalAddress || null,
        associationName: associationName || null,
        associationMembershipNumber: associationMembershipNumber || null,
        associationDocument: associationDocument || null,
        associationListingUrl: associationListingUrl || null,
        status: 'PENDING',
      },
    });

    res.status(201).json({ success: true, verification });
  } catch (err) {
    next(err);
  }
};

// GET /api/profile/verification/status
const getVerificationStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const verification = await prisma.businessVerification.findUnique({ where: { userId } });
    res.json({
      success: true,
      status: verification?.status || 'NONE',
      verification,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfileByHandle,
  getProfilePosts,
  getProfileReviews,
  updateMyProfile,
  updateBusinessProfile,
  submitVerification,
  getVerificationStatus,
};

