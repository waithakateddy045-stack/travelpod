const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/broadcasts — Association sends a broadcast
const createBroadcast = async (req, res, next) => {
    try {
        if (req.user.accountType !== 'ASSOCIATION') throw new AppError('Only associations can broadcast', 403);
        const { title, message, targetAccountTypes, region } = req.body;
        if (!title || !message) throw new AppError('Title and message required', 400);

        const broadcast = await prisma.broadcast.create({
            data: {
                senderId: req.user.id,
                title: title.trim(), message: message.trim(),
                targetAccountTypes: targetAccountTypes || [],
                region: region?.trim() || null,
            },
        });
        res.status(201).json({ success: true, broadcast });
    } catch (err) { next(err); }
};

// GET /api/broadcasts — Get broadcasts for current user
const getBroadcasts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const broadcasts = await prisma.broadcast.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit, take: limit,
            include: { sender: { select: { profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } },
        });
        res.json({ success: true, broadcasts, page });
    } catch (err) { next(err); }
};

module.exports = { createBroadcast, getBroadcasts };
