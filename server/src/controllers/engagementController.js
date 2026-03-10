const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// ============ LIKES ============

const likePost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) throw new AppError('Post not found', 404);
        // if (post.userId === userId) throw new AppError('You cannot like your own post', 400);

        const existing = await prisma.like.findUnique({
            where: { userId_postId: { userId, postId } },
        });
        if (existing) return res.json({ success: true, message: 'Already liked' });

        await prisma.like.create({ data: { userId, postId } });
        await prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });

        // Trigger Notification
        const { createNotification } = require('./notificationController');
        if (post.userId !== userId) {
            createNotification({
                userId: post.userId,
                type: 'post_liked',
                title: 'Post Liked!',
                body: `${req.user.profile?.displayName || 'Someone'} liked your post.`,
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

        await prisma.like.delete({ where: { userId_postId: { userId, postId } } }).catch(() => { });
        await prisma.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }).catch(() => { });

        res.json({ success: true, message: 'Like removed' });
    } catch (err) { next(err); }
};

// ============ SAVES ============

const savePost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        const existing = await prisma.save.findUnique({
            where: { userId_postId: { userId, postId } },
        });
        if (existing) return res.json({ success: true, message: 'Already saved' });

        await prisma.save.create({ data: { userId, postId } });
        await prisma.post.update({ where: { id: postId }, data: { saveCount: { increment: 1 } } });
        res.status(201).json({ success: true, message: 'Post saved' });
    } catch (err) { next(err); }
};

const unsavePost = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        await prisma.save.delete({ where: { userId_postId: { userId, postId } } }).catch(() => { });
        await prisma.post.update({ where: { id: postId }, data: { saveCount: { decrement: 1 } } }).catch(() => { });
        res.json({ success: true, message: 'Post unsaved' });
    } catch (err) { next(err); }
};

// ============ COMMENTS ============

const addComment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;
        const { text, parentId } = req.body;

        if (!text?.trim()) throw new AppError('Comment text is required', 400);

        const comment = await prisma.comment.create({
            data: {
                userId,
                postId,
                content: text.trim(),
                parentId: parentId || null,
            },
            include: {
                user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
            },
        });

        await prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
        
        if (parentId) {
            await prisma.comment.update({
                where: { id: parentId },
                data: { replyCount: { increment: 1 } }
            });
            // Notify parent comment author
            const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
            if (parentComment && parentComment.userId !== userId) {
                const { createNotification } = require('./notificationController');
                createNotification({
                    userId: parentComment.userId,
                    type: 'post_commented',
                    title: 'New Reply!',
                    body: `${req.user.profile?.displayName || 'Someone'} replied to your comment.`,
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
                    body: `${req.user.profile?.displayName || 'Someone'} commented on your post.`,
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
                where: { postId, parentId: null },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                    _count: { select: { replies: true } },
                },
            }),
            prisma.comment.count({ where: { postId, parentId: null } }),
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
                where: { parentId: commentId },
                orderBy: { createdAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                },
            }),
            prisma.comment.count({ where: { parentId: commentId } }),
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
        const parentId = comment.parentId;

        await prisma.comment.delete({ where: { id: commentId } });
        
        // Update counts
        await prisma.post.update({ where: { id: postId }, data: { commentCount: { decrement: 1 } } }).catch(() => { });
        if (parentId) {
            await prisma.comment.update({
                where: { id: parentId },
                data: { replyCount: { decrement: 1 } }
            }).catch(() => { });
        }

        res.json({ success: true, message: 'Comment deleted' });
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
                            author: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } }
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

module.exports = { likePost, unlikePost, savePost, unsavePost, addComment, getComments, getReplies, deleteComment, getSavedPosts };
