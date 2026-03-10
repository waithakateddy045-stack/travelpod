const prisma = require('../utils/prisma');

// Create a notification
const createNotification = async ({ userId, type, title, body, relatedEntityId, relatedEntityType, metadata }) => {
    try {
        return await prisma.notification.create({
            data: { userId, type, title, message: body, relatedEntityId, relatedEntityType },
        });
    } catch (err) {
        console.error('Failed to create notification:', err.message);
    }
};

// GET /api/notifications
const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit, take: limit,
            }),
            prisma.notification.count({ where: { userId } }),
            prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        // For follow notifications, resolve the related user's username/avatar so the frontend can link to their profile
        const enriched = await Promise.all(
            notifications.map(async (n) => {
                if (n.type === 'new_follower' && n.relatedEntityType === 'user' && n.relatedEntityId) {
                    const user = await prisma.user.findUnique({
                        where: { id: n.relatedEntityId },
                        select: { username: true, avatarUrl: true },
                    });
                    return {
                        ...n,
                        _senderHandle: user?.username || null,
                        _senderAvatar: user?.avatarUrl || null,
                    };
                }
                return n;
            })
        );

        res.json({ success: true, notifications: enriched, total, unreadCount, page });
    } catch (err) { next(err); }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res, next) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (err) { next(err); }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res, next) => {
    try {
        await prisma.notification.update({
            where: { id: req.params.id },
            data: { isRead: true },
        });
        res.json({ success: true });
    } catch (err) { next(err); }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res, next) => {
    try {
        const count = await prisma.notification.count({
            where: { userId: req.user.id, isRead: false },
        });
        res.json({ success: true, count });
    } catch (err) { next(err); }
};

module.exports = { createNotification, getNotifications, markAllRead, markRead, getUnreadCount };
