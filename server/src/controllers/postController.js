const fs = require('fs');
const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadVideo, uploadImage, getVideoThumbnail } = require('../services/cloudinary');

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  accountType: true,
  isVerified: true,
};

// ============================================================
// GET /api/posts — List posts (legacy + admin usage)
// ============================================================
const listPosts = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const destination = req.query.destination ? String(req.query.destination).trim() : null;
    const category = req.query.category ? String(req.query.category).trim() : null;

    const where = {
      moderationStatus: 'APPROVED',
      ...(destination && { locationTag: { equals: destination, mode: 'insensitive' } }),
      ...(category && category !== 'All' && { category: { contains: category, mode: 'insensitive' } }),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: publicUserSelect } },
      }),
      prisma.post.count({ where }),
    ]);

    res.json({ success: true, posts, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/posts — Create a new post
// Supports VIDEO, PHOTO, TEXT posts per PRD
// ============================================================
const createPost = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      postType = 'VIDEO',
      location,
      locationTag,
      category,
      tags,
      textContent,
      musicTitle,
      isReview,
      reviewOfId,
      starRating,
      thumbnailTime,
    } = req.body;

    if (!title && postType !== 'TEXT') throw new AppError('Title is required', 400);

    let videoUrl = null;
    let thumbnailUrl = null;
    let mediaUrls = [];
    let duration = null;

    // Video upload
    if (postType === 'VIDEO' && req.file) {
      const cloudResult = await uploadVideo(req.file.path);
      videoUrl = cloudResult.secure_url;
      duration = Math.round(cloudResult.duration || 0);
      thumbnailUrl = getVideoThumbnail(cloudResult.public_id, thumbnailTime || 0);
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }

    // Photo upload (multi-image carousel)
    if (postType === 'PHOTO' && req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadImage(file.path, 'posts/photos');
        mediaUrls.push(result.secure_url);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      thumbnailUrl = mediaUrls[0] || null;
    }

    const tagList = tags
      ? (Array.isArray(tags) ? tags : String(tags).split(',').map((t) => t.trim()).filter(Boolean))
      : [];

    const post = await prisma.post.create({
      data: {
        userId,
        postType,
        title: title || (postType === 'TEXT' ? (textContent || '').slice(0, 80) : 'Untitled'),
        description: description || null,
        textContent: postType === 'TEXT' ? (textContent || '').slice(0, 500) : textContent || null,
        videoUrl,
        thumbnailUrl,
        mediaUrls: mediaUrls.length ? mediaUrls : null,
        duration,
        location: location || null,
        locationTag: locationTag || null,
        category: category || null,
        tags: tagList.length ? tagList : null,
        musicTitle: musicTitle || null,
        moderationStatus: 'PENDING',
        isReview: postType === 'REVIEW' || isReview === true || isReview === 'true',
        reviewOfId: reviewOfId || null,
        starRating: starRating ? Number(starRating) : null,
      },
    });

    // If this is a review of another post, mirror as REVIEW comment
    if (post.isReview && reviewOfId) {
      const original = await prisma.post.findUnique({ where: { id: reviewOfId } });
      if (original) {
        await prisma.comment.create({
          data: {
            postId: reviewOfId,
            userId,
            content: description || textContent || 'Reviewed this post',
            commentType: 'REVIEW',
            linkedPostId: post.id,
          },
        });
        await prisma.post.update({
          where: { id: reviewOfId },
          data: { commentCount: { increment: 1 } },
        }).catch(() => {});
      }
    }

    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/posts/check-duplicate — stubbed (no perceptual hash schema)
// ============================================================
const checkDuplicate = async (req, res, next) => {
  try {
    res.json({ success: true, isDuplicate: false, postId: null });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/posts/:id — Single post
// ============================================================
const getPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: { user: { select: publicUserSelect } },
    });
    if (!post) throw new AppError('Post not found', 404);

    await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    let isLiked = false;
    let isSaved = false;
    if (req.user) {
      const [like, save] = await Promise.all([
        prisma.like.findUnique({ where: { postId_userId: { postId: id, userId: req.user.id } } }).catch(() => null),
        prisma.save.findUnique({ where: { postId_userId: { postId: id, userId: req.user.id } } }).catch(() => null),
      ]);
      isLiked = !!like;
      isSaved = !!save;
    }

    res.json({ success: true, post: { ...post, isLiked, isSaved } });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE /api/posts/:id — Delete own post
// ============================================================
const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw new AppError('Post not found', 404);
    if (post.userId !== req.user.id && req.user.accountType !== 'ADMIN') {
      throw new AppError('Not authorized to delete this post', 403);
    }
    await prisma.post.delete({ where: { id } });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Moderation endpoints (Admin) — basic PENDING/APPROVED/REJECTED
// ============================================================
const getModerationQueue = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const status = req.query.status || 'PENDING';

    let where = {};
    if (status === 'REPORTED') {
      where = { reports: { some: {} } };
    } else if (status !== 'ALL') {
      where = { moderationStatus: status };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: publicUserSelect },
          _count: { select: { reports: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    res.json({ success: true, posts, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

const moderatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (action === 'CLEAR_REPORTS') {
      await prisma.report.deleteMany({ where: { postId: id } });
      return res.json({ success: true, message: 'Reports cleared' });
    }

    let finalStatus;
    switch (action) {
      case 'APPROVE':
      case 'APPROVED':
        finalStatus = 'APPROVED';
        break;
      case 'REJECT':
      case 'REJECTED':
      case 'REMOVE':
      case 'REMOVED':
        finalStatus = 'REJECTED';
        break;
      case 'PENDING':
        finalStatus = 'PENDING';
        break;
      default:
        throw new AppError('Invalid moderation action', 400);
    }

    const post = await prisma.post.update({
      where: { id },
      data: { moderationStatus: finalStatus },
    });
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/posts/:id/repost — not implemented in PRD v3.0
// ============================================================
const repostPost = async (req, res, next) => {
  try {
    res.status(501).json({ success: false, message: 'Repost is not supported in this version.' });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/posts/:id/recommend — not implemented in PRD v3.0
// ============================================================
const recommendPost = async (req, res, next) => {
  try {
    res.status(501).json({ success: false, message: 'Recommend is not supported in this version.' });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/posts/:id — lightweight metadata update
// ============================================================
const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { thumbnailUrl, title, description, category, musicTitle, tags } = req.body;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw new AppError('Post not found', 404);
    if (post.userId !== userId && req.user.accountType !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    const tagList = tags
      ? (Array.isArray(tags) ? tags : String(tags).split(',').map((t) => t.trim()).filter(Boolean))
      : null;

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(thumbnailUrl && { thumbnailUrl }),
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
        ...(musicTitle && { musicTitle }),
        ...(tagList && { tags: tagList }),
      },
    });

    res.json({ success: true, post: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPosts,
  createPost,
  getPost,
  deletePost,
  getModerationQueue,
  moderatePost,
  repostPost,
  recommendPost,
  checkDuplicate,
  updatePost,
};
