const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const publicUserSelect = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    accountType: true,
    isVerified: true,
};

// ============ LIKES ============

const likePost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) throw new AppError('Post not found', 404);
        // if (post.userId === userId) throw new AppError('You cannot like your own post', 400);

        const existing = await prisma.like.findUnique({
            where: { postId_userId: { postId, userId } },
        });
        if (existing) return res.json({ success: true, message: 'Already liked' });

        await prisma.like.create({ data: { userId, postId } });
        await prisma.post.update({
            where: { id: postId },
            data: { likeCount: { increment: 1 } },
        });

        // Trigger Notification
        const { createNotification } = require('./notificationController');
        if (post.userId !== userId) {
            createNotification({
                userId: post.userId,
                type: 'post_liked',
                title: 'Post Liked!',
                body: `${req.user.displayName || req.user.username || 'Someone'} liked your post.`,
                relatedEntityId: postId,
                relatedEntityType: 'post'
            }).catch(() => { });
        }

        res.status(201).json({ success: true, message: 'Post liked' });
    } catch (err) { next(err); }
};

const unlikePost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        await prisma.like.delete({ where: { postId_userId: { postId, userId } } }).catch(() => { });
        await prisma.post.update({
            where: { id: postId },
            data: {
                likeCount: {
                    decrement: 1,
                },
            },
        }).catch(() => { });

        res.json({ success: true, message: 'Like removed' });
    } catch (err) { next(err); }
};

// ============ SAVES ============

const savePost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        const existing = await prisma.save.findUnique({
            where: { postId_userId: { postId, userId } },
        });
        if (existing) return res.json({ success: true, message: 'Already saved' });

        await prisma.save.create({ data: { userId, postId } });
        await prisma.post.update({
            where: { id: postId },
            data: { saveCount: { increment: 1 } },
        });
        res.status(201).json({ success: true, message: 'Post saved' });
    } catch (err) { next(err); }
};

const unsavePost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        await prisma.save.delete({ where: { postId_userId: { postId, userId } } }).catch(() => { });
        await prisma.post.update({
            where: { id: postId },
            data: {
                saveCount: {
                    decrement: 1,
                },
            },
        }).catch(() => { });
        res.json({ success: true, message: 'Post unsaved' });
    } catch (err) { next(err); }
};

// ============ COMMENTS ============

const addComment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;
        const { content, parentCommentId, linkedPostId } = req.body;

        if (!content?.trim()) throw new AppError('Comment content is required', 400);

        let normalizedParentId = parentCommentId || null;
        if (normalizedParentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: normalizedParentId },
                select: { id: true, parentCommentId: true, postId: true },
            });
            if (!parent || parent.postId !== postId) throw new AppError('Invalid parent comment', 400);
            // Replies-to-replies attach to the same root parent (UI nesting depth capped at 1)
            normalizedParentId = parent.parentCommentId || parent.id;
        }

        const comment = await prisma.comment.create({
            data: {
                userId,
                postId,
                content: content.trim(),
                parentCommentId: normalizedParentId,
                linkedPostId: linkedPostId || null,
            },
            include: {
                user: { select: publicUserSelect },
            },
        });

        await prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });

        if (normalizedParentId) {
            // Notify parent comment author
            const parentComment = await prisma.comment.findUnique({ where: { id: normalizedParentId } });
            if (parentComment && parentComment.userId !== userId) {
                const { createNotification } = require('./notificationController');
                createNotification({
                    userId: parentComment.userId,
                    type: 'comment_replied',
                    title: 'New Reply!',
                    body: `${req.user.displayName || req.user.username || 'Someone'} replied to your comment.`,
                    relatedEntityId: postId,
                    relatedEntityType: 'post'
                }).catch(() => { });
            }
        } else {
            // Notify post author
            const post = await prisma.post.findUnique({ where: { id: postId } });
            if (post && post.userId !== userId) {
                const { createNotification } = require('./notificationController');
                createNotification({
                    userId: post.userId,
                    type: 'post_commented',
                    title: 'New Comment!',
                    body: `${req.user.displayName || req.user.username || 'Someone'} commented on your post.`,
                    relatedEntityId: postId,
                    relatedEntityType: 'post'
                }).catch(() => { });
            }
        }

        res.status(201).json({ success: true, comment });
    } catch (err) { next(err); }
};

const getComments = async (req, res, next) => {
    try {
        const postId = req.params.postId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [comments, total] = await Promise.all([
            prisma.comment.findMany({
                where: { postId, parentCommentId: null },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: publicUserSelect },
                    replies: {
                        orderBy: { createdAt: 'asc' },
                        take: 2,
                        include: { user: { select: publicUserSelect } },
                    },
                    _count: { select: { replies: true } },
                },
            }),
            prisma.comment.count({ where: { postId, parentCommentId: null } }),
        ]);

        res.json({ success: true, comments, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

const getReplies = async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const [replies, total] = await Promise.all([
            prisma.comment.findMany({
                where: { parentCommentId: commentId },
                orderBy: { createdAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: publicUserSelect },
                },
            }),
            prisma.comment.count({ where: { parentCommentId: commentId } }),
        ]);

        res.json({ success: true, replies, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

const deleteComment = async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const comment = await prisma.comment.findUnique({ where: { id: commentId } });

        if (!comment) throw new AppError('Comment not found', 404);
        if (comment.userId !== req.user.id && req.user.accountType !== 'ADMIN') {
            throw new AppError('Not authorized', 403);
        }

        const postId = comment.postId;
        const parentId = comment.parentCommentId;

        await prisma.comment.delete({ where: { id: commentId } });

        // Update counts
        await prisma.post.update({ where: { id: postId }, data: { commentCount: { decrement: 1 } } }).catch(() => { });
        // reply counts are derived via _count in queries

        res.json({ success: true, message: 'Comment deleted' });
    } catch (err) { next(err); }
};

const toggleCommentLike = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { commentId } = req.params;

        const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
        if (!comment) throw new AppError('Comment not found', 404);

        const existing = await prisma.commentLike.findUnique({
            where: { commentId_userId: { commentId, userId } }
        });

        if (existing) {
            await prisma.commentLike.delete({ where: { commentId_userId: { commentId, userId } } });
            await prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } }).catch(() => { });
            return res.json({ success: true, liked: false });
        }

        await prisma.commentLike.create({ data: { commentId, userId } });
        await prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } }).catch(() => { });
        res.status(201).json({ success: true, liked: true });
    } catch (err) { next(err); }
};

const getSavedPosts = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;

        const [saves, total] = await Promise.all([
            prisma.save.findMany({
                where: { userId },
                include: {
                    post: {
                        include: {
                            user: { select: publicUserSelect }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.save.count({ where: { userId } })
        ]);

        const posts = saves.map(s => ({
            ...s.post,
            isSaved: true
        }));

        res.json({
            success: true,
            posts,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) { next(err); }
};

module.exports = { likePost, unlikePost, savePost, unsavePost, addComment, getComments, getReplies, deleteComment, toggleCommentLike, getSavedPosts };
