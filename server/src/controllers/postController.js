const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadVideo, uploadImage, getVideoThumbnail } = require('../services/cloudinary');
const fs = require('fs');

// ============================================================
// POST /api/posts — Create a new post (video + metadata)
// ============================================================
const createPost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { title, description, postType, categoryId, category, locationTag, tags, isReview, businessId, starRating } = req.body;

        if (!title) throw new AppError('Title is required', 400);

        if (postType === 'BROADCAST' && !['ASSOCIATION', 'ADMIN'].includes(req.user.accountType)) {
            throw new AppError('Only associations and admins can create broadcast posts', 403);
        }

        let videoUrl = null;
        let thumbnailUrl = null;
        let duration = null;

        if (req.file) {
            try {
                const cloudResult = await uploadVideo(req.file.path);
                videoUrl = cloudResult.secure_url;
                thumbnailUrl = getVideoThumbnail(cloudResult.public_id);
                duration = Math.round(cloudResult.duration || 0);
            } catch (uploadErr) {
                console.error('Cloudinary upload failed:', uploadErr.message);
                throw new AppError('Video upload failed. Please try again.', 500);
            } finally {
                if (req.file.path && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
            }
        } else if (postType !== 'BROADCAST' && !req.body.videoUrl) {
            // We might want to enforce video for STANDARD posts, but for now allow optional
            // throw new AppError('Video file required for standard posts', 400);
        }

        // Use videoUrl from body if provided and file is missing
        if (!videoUrl && req.body.videoUrl) videoUrl = req.body.videoUrl;

        // Resolve category name to categoryId if needed
        let resolvedCategoryId = categoryId || null;
        if (!resolvedCategoryId && category) {
            const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const cat = await prisma.category.upsert({
                where: { slug },
                update: {},
                create: { name: category, slug },
            });
            resolvedCategoryId = cat.id;
        }

        const post = await prisma.post.create({
            data: {
                userId,
                title,
                description: description || null,
                videoUrl,
                thumbnailUrl,
                duration: duration || 0,
                postType: postType || 'STANDARD',
                categoryId: resolvedCategoryId,
                locationTag: locationTag || null,
                moderationStatus: 'APPROVED',
            },
        });

        // Attach tags via PostTag
        if (tags) {
            const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
            for (const tagName of tagList) {
                const tag = await prisma.tag.upsert({
                    where: { name: tagName },
                    update: {},
                    create: { name: tagName },
                });
                await prisma.postTag.create({ data: { postId: post.id, tagId: tag.id } }).catch(() => { });
            }
        }

        if (isReview === 'true' && businessId && starRating) {
            await prisma.videoReview.create({
                data: {
                    postId: post.id,
                    reviewerId: userId,
                    businessId,
                    starRating: parseInt(starRating, 10),
                    caption: title,
                },
            });
        }

        res.status(201).json({ success: true, post });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/posts/:id — Single post
// ============================================================
const getPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await prisma.post.findUnique({
            where: { id },
            include: {
                author: {
                    select: { id: true, accountType: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } },
                },
                videoReview: { include: { reviewResponse: true } },
                postTags: { include: { tag: true } },
                category: true,
            },
        });

        if (!post) throw new AppError('Post not found', 404);

        await prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } });

        let isLiked = false, isSaved = false;
        if (req.user) {
            const [like, save] = await Promise.all([
                prisma.like.findUnique({ where: { userId_postId: { userId: req.user.id, postId: id } } }),
                prisma.save.findUnique({ where: { userId_postId: { userId: req.user.id, postId: id } } }),
            ]);
            isLiked = !!like;
            isSaved = !!save;
        }

        res.json({ success: true, post: { ...post, isLiked, isSaved } });
    } catch (err) { next(err); }
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

        // Hard delete — cascade handles related records
        await prisma.post.delete({ where: { id } });

        res.json({ success: true, message: 'Post deleted' });
    } catch (err) { next(err); }
};

// ============================================================
// Moderation endpoints (Admin)
// ============================================================
const getModerationQueue = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
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
                    author: { select: { id: true, profile: { select: { displayName: true, handle: true } } } },
                    category: true,
                    postTags: { include: { tag: true } },
                    _count: { select: { reports: true } }
                },
            }),
            prisma.post.count({ where }),
        ]);

        // Rename author -> user for frontend consistency
        const mapped = posts.map(p => ({ ...p, user: p.author }));
        res.json({ success: true, posts: mapped, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

const moderatePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;

        const finalAction = action === 'REJECTED' ? 'REMOVED' :
            (action === 'RESTORED' || action === 'RESTORE' ? 'APPROVED' : action);

        if (action === 'CLEAR_REPORTS') {
            await prisma.report.deleteMany({ where: { postId: id } });
            return res.json({ success: true, message: 'Reports cleared', count: 0 });
        }

        const validStatuses = ['APPROVED', 'REMOVED', 'PENDING', 'UNDER_REVIEW'];
        if (!validStatuses.includes(finalAction)) {
            throw new AppError('Invalid moderation action: ' + finalAction, 400);
        }

        const post = await prisma.post.update({
            where: { id },
            data: { moderationStatus: finalAction },
        });

        res.json({ success: true, post });
    } catch (err) { next(err); }
};

module.exports = { createPost, getPost, deletePost, getModerationQueue, moderatePost };
