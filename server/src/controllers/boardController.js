const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const publicUserSelect = {
    id: true,
    email: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    accountType: true,
    isVerified: true,
};

const attachLegacyProfile = (user) => {
    if (!user) return null;
    return {
        ...user,
        profile: {
            displayName: user.displayName || user.username || 'Traveler',
            handle: user.username,
            avatarUrl: user.avatarUrl,
            businessProfile: {
                verificationStatus: user.isVerified ? 'APPROVED' : 'NONE',
            },
        },
    };
};

// ============================================================
// POST /api/boards — Create a new board
// ============================================================
const createBoard = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { title, description, destination, coverImage, isPublic } = req.body;
        if (!title?.trim()) throw new AppError('Title is required', 400);

        const board = await prisma.tripBoard.create({
            data: {
                userId,
                title: title.trim(),
                description: description?.trim() || null,
                destination: destination?.trim() || null,
                coverImage: coverImage || null,
                isPublic: isPublic !== false,
            },
            include: {
                user: { select: publicUserSelect },
            },
        });
        res.status(201).json({
            success: true,
            board: {
                ...board,
                user: attachLegacyProfile(board.user),
            },
        });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/boards/feed — Public boards feed
// ============================================================
const getBoardsFeed = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const destination = req.query.destination || null;
        const sort = req.query.sort || 'personalized'; // personalized | popular | newest
        const userId = req.user?.id;

        const where = { isPublic: true };
        if (destination) {
            where.destination = { contains: destination, mode: 'insensitive' };
        }

        // Fetch a pool for personalization
        const poolSize = sort === 'personalized' ? 200 : limit;
        const [boards, total] = await Promise.all([
            prisma.tripBoard.findMany({
                where,
                orderBy: sort === 'personalized' ? [{ createdAt: 'desc' }] : (sort === 'popular'
                    ? [{ likeCount: 'desc' }, { followerCount: 'desc' }, { createdAt: 'desc' }]
                    : [{ createdAt: 'desc' }]),
                take: poolSize,
                include: {
                    user: { select: publicUserSelect },
                    videos: {
                        take: 1,
                        orderBy: { addedAt: 'asc' },
                        include: { post: { select: { thumbnailUrl: true } } },
                    },
                },
            }),
            prisma.tripBoard.count({ where }),
        ]);

        let processed = boards.map(b => ({
            ...b,
            user: attachLegacyProfile(b.user),
            coverImage: b.coverImage || b.videos?.[0]?.post?.thumbnailUrl || null,
        }));

        // Personalized scoring if requested
        if (sort === 'personalized' && userId) {
            // Simple heuristic: Boost boards with same destination as recently liked posts
            const recentLikes = await prisma.like.findMany({
                where: { userId },
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: { post: { select: { locationTag: true } } }
            });
            const prefDestinations = new Set(recentLikes.map(l => l.post.locationTag).filter(Boolean));

            processed = processed.map(b => {
                let score = 0;
                if (b.destination && prefDestinations.has(b.destination)) score += 50;
                score += (b.likeCount * 2) + (b.followerCount * 5);
                // Freshness bonus
                const daysOld = (Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                score += Math.max(100 - daysOld, 0);
                return { ...b, _score: score };
            });
            processed.sort((a, b) => b._score - a._score);
            processed = processed.slice((page - 1) * limit, page * limit);
        } else if (sort === 'personalized') {
            // Default to popular for guests in personalized mode
            processed.sort((a, b) => (b.likeCount + b.followerCount) - (a.likeCount + a.followerCount));
            processed = processed.slice((page - 1) * limit, page * limit);
        }

        if (userId) {
            const boardIds = processed.map(b => b.id);
            const [likes, saves, follows] = await Promise.all([
                prisma.boardLike.findMany({ where: { userId, boardId: { in: boardIds } }, select: { boardId: true } }),
                prisma.boardSave.findMany({ where: { userId, boardId: { in: boardIds } }, select: { boardId: true } }),
                prisma.boardFollow.findMany({ where: { userId, boardId: { in: boardIds } }, select: { boardId: true } }),
            ]);
            const likedSet = new Set(likes.map(l => l.boardId));
            const savedSet = new Set(saves.map(s => s.boardId));
            const followedSet = new Set(follows.map(f => f.boardId));
            processed = processed.map(b => ({
                ...b,
                isLiked: likedSet.has(b.id),
                isSaved: savedSet.has(b.id),
                isFollowed: followedSet.has(b.id),
            }));
        }

        res.json({ success: true, boards: processed, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/boards/:id — Single board detail
// ============================================================
const getBoard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const board = await prisma.tripBoard.findUnique({
            where: { id },
            include: {
                user: { select: publicUserSelect },
                videos: {
                    orderBy: { addedAt: 'asc' },
                    include: {
                        post: {
                            select: {
                                id: true, title: true, thumbnailUrl: true, videoUrl: true, viewCount: true, likeCount: true, duration: true,
                                user: { select: publicUserSelect },
                            },
                        },
                    },
                },
            },
        });

        if (!board) throw new AppError('Board not found', 404);

        let engagement = { isLiked: false, isSaved: false, isFollowed: false };
        if (userId) {
            const [like, save, follow] = await Promise.all([
                prisma.boardLike.findUnique({ where: { boardId_userId: { boardId: id, userId } } }),
                prisma.boardSave.findUnique({ where: { boardId_userId: { boardId: id, userId } } }),
                prisma.boardFollow.findUnique({ where: { boardId_userId: { boardId: id, userId } } }),
            ]);
            engagement = { isLiked: !!like, isSaved: !!save, isFollowed: !!follow };
        }

        res.json({
            success: true,
            board: {
                ...board,
                user: attachLegacyProfile(board.user),
                videos: board.videos.map((v) => ({
                    ...v,
                    post: v.post
                        ? {
                            ...v.post,
                            author: attachLegacyProfile(v.post.user),
                        }
                        : null,
                })),
                coverImage: board.coverImage || board.videos?.[0]?.post?.thumbnailUrl || null,
                ...engagement,
            },
        });
    } catch (err) { next(err); }
};

// ============================================================
// PUT /api/boards/:id — Update a board
// ============================================================
const updateBoard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { title, description, destination, coverImage, isPublic } = req.body;

        const board = await prisma.tripBoard.findUnique({ where: { id } });
        if (!board) throw new AppError('Board not found', 404);
        if (board.userId !== userId) throw new AppError('Not authorized', 403);

        const updated = await prisma.tripBoard.update({
            where: { id },
            data: {
                ...(title && { title: title.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(destination !== undefined && { destination: destination?.trim() || null }),
                ...(coverImage !== undefined && { coverImage }),
                ...(isPublic !== undefined && { isPublic }),
            },
        });
        res.json({ success: true, board: updated });
    } catch (err) { next(err); }
};

// ============================================================
// DELETE /api/boards/:id
// ============================================================
const deleteBoard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const board = await prisma.tripBoard.findUnique({ where: { id } });
        if (!board) throw new AppError('Board not found', 404);
        if (board.userId !== req.user.id) throw new AppError('Not authorized', 403);
        await prisma.tripBoard.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) { next(err); }
};

// ============================================================
// POST /api/boards/:id/videos — Add video to board
// ============================================================
const addVideoToBoard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { postId } = req.body;
        const board = await prisma.tripBoard.findUnique({ where: { id } });
        if (!board) throw new AppError('Board not found', 404);
        if (board.userId !== req.user.id) throw new AppError('Not authorized', 403);

        await prisma.tripBoardVideo.create({ data: { boardId: id, postId } });
        res.json({ success: true });
    } catch (err) { next(err); }
};

// ============================================================
// DELETE /api/boards/:id/videos/:postId
// ============================================================
const removeVideoFromBoard = async (req, res, next) => {
    try {
        const { id, postId } = req.params;
        const board = await prisma.tripBoard.findUnique({ where: { id } });
        if (!board) throw new AppError('Board not found', 404);
        if (board.userId !== req.user.id) throw new AppError('Not authorized', 403);

        await prisma.tripBoardVideo.delete({ where: { boardId_postId: { boardId: id, postId } } });
        res.json({ success: true });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/boards/user/:handle — User/business boards
// ============================================================
const getUserBoards = async (req, res, next) => {
    try {
        const { handle } = req.params;
        const user = await prisma.user.findUnique({
            where: { username: handle },
            select: { id: true },
        });
        if (!user) throw new AppError('User not found', 404);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;

        const [boards, total] = await Promise.all([
            prisma.tripBoard.findMany({
                where: { userId: user.id, isPublic: true },
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: publicUserSelect },
                    videos: { take: 1, orderBy: { addedAt: 'asc' }, include: { post: { select: { thumbnailUrl: true } } } },
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.tripBoard.count({ where: { userId: user.id, isPublic: true } })
        ]);

        res.json({
            success: true,
            boards: boards.map(b => ({
                ...b,
                user: attachLegacyProfile(b.user),
                coverImage: b.coverImage || b.videos?.[0]?.post?.thumbnailUrl || null,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) { next(err); }
};

// ============================================================
// POST /api/boards/:id/like — Toggle like
// ============================================================
const toggleLike = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const existing = await prisma.boardLike.findUnique({ where: { boardId_userId: { boardId: id, userId } } });
        if (existing) {
            await prisma.boardLike.delete({ where: { id: existing.id } });
            await prisma.tripBoard.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
            res.json({ success: true, liked: false });
        } else {
            await prisma.boardLike.create({ data: { boardId: id, userId } });
            await prisma.tripBoard.update({ where: { id }, data: { likeCount: { increment: 1 } } });
            res.json({ success: true, liked: true });
        }
    } catch (err) { next(err); }
};

// ============================================================
// POST /api/boards/:id/save
// ============================================================
const toggleSave = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const existing = await prisma.boardSave.findUnique({ where: { boardId_userId: { boardId: id, userId } } });
        if (existing) {
            await prisma.boardSave.delete({ where: { id: existing.id } });
            await prisma.tripBoard.update({ where: { id }, data: { saveCount: { decrement: 1 } } });
            res.json({ success: true, saved: false });
        } else {
            await prisma.boardSave.create({ data: { boardId: id, userId } });
            await prisma.tripBoard.update({ where: { id }, data: { saveCount: { increment: 1 } } });
            res.json({ success: true, saved: true });
        }
    } catch (err) { next(err); }
};

// ============================================================
// POST /api/boards/:id/follow
// ============================================================
const toggleFollow = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const existing = await prisma.boardFollow.findUnique({ where: { boardId_userId: { boardId: id, userId } } });
        if (existing) {
            await prisma.boardFollow.delete({ where: { id: existing.id } });
            await prisma.tripBoard.update({ where: { id }, data: { followerCount: { decrement: 1 } } });
            res.json({ success: true, followed: false });
        } else {
            await prisma.boardFollow.create({ data: { boardId: id, userId } });
            await prisma.tripBoard.update({ where: { id }, data: { followerCount: { increment: 1 } } });
            res.json({ success: true, followed: true });
        }
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/boards/:id/comments
// ============================================================
const getComments = async (req, res, next) => {
    try {
        const { id } = req.params;
        const comments = await prisma.boardComment.findMany({
            where: { boardId: id },
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: publicUserSelect },
            },
        });
        res.json({
            success: true,
            comments: comments.map((c) => ({
                ...c,
                user: attachLegacyProfile(c.user),
            })),
        });
    } catch (err) { next(err); }
};

// ============================================================
// POST /api/boards/:id/comments
// ============================================================
const addComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content?.trim()) throw new AppError('Comment content is required', 400);

        const comment = await prisma.boardComment.create({
            data: { boardId: id, userId: req.user.id, content: content.trim() },
            include: { user: { select: publicUserSelect } },
        });
        res.json({
            success: true,
            comment: {
                ...comment,
                user: attachLegacyProfile(comment.user),
            },
        });
    } catch (err) { next(err); }
};

// ============================================================
// DELETE /api/boards/:id/comments/:commentId
// ============================================================
const deleteComment = async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const comment = await prisma.boardComment.findUnique({ where: { id: commentId } });
        if (!comment) throw new AppError('Comment not found', 404);
        if (comment.userId !== req.user.id) throw new AppError('Not authorized', 403);
        await prisma.boardComment.delete({ where: { id: commentId } });
        res.json({ success: true });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/boards/user/me — My boards
// ============================================================
const getMyBoards = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;

        const [boards, total] = await Promise.all([
            prisma.tripBoard.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                include: {
                    _count: { select: { videos: true } }
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.tripBoard.count({ where: { userId } })
        ]);

        const mapped = boards.map(b => ({
            ...b,
            videoCount: b._count.videos
        }));

        res.json({
            success: true,
            boards: mapped,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) { next(err); }
};

module.exports = {
    createBoard, getBoardsFeed, getBoard, updateBoard, deleteBoard,
    addVideoToBoard, removeVideoFromBoard, getUserBoards,
    toggleLike, toggleSave, toggleFollow,
    getComments, addComment, deleteComment, getMyBoards
};
