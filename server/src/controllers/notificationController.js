const prisma = require('../utils/prisma');
const { NOTIFICATION_TYPES } = require('../utils/constants');

// Create a notification
const createNotification = async ({ userId, type, title, body, relatedEntityId, relatedEntityType }) => {
    try {
        return await prisma.notification.create({
            data: { userId, type, title, body, relatedEntityId, relatedEntityType },
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
            prisma.notification.count({ where: { userId, readAt: null } }),
        ]);

        res.json({ success: true, notifications, total, unreadCount, page });
    } catch (err) { next(err); }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res, next) => {
    try {
        await prisma.notification.updateMany({
            where: { recipientId: req.user.id, isRead: false },
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

module.exports = { createNotification, getNotifications, markAllRead, markRead };
