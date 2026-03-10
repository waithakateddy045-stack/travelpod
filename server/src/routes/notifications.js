const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../utils/prisma');
const { getNotifications, markAllRead, markRead } = require('../controllers/notificationController');

router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [notifCount, msgUnread] = await Promise.all([
            prisma.notification.count({
                where: { userId, readAt: null },
            }),
            prisma.message.count({
                where: {
                    isRead: false,
                    senderId: { not: userId },
                    conversation: {
                        participants: {
                            some: { userId },
                        },
                    },
                },
            }),
        ]);

        res.json({
            success: true,
            count: notifCount + msgUnread,
            notifications: notifCount,
            messages: msgUnread,
        });
    } catch (err) {
        console.error('Unread count error:', err);
        res.status(500).json({ success: false });
    }
});
router.put('/read-all', authenticate, markAllRead);
router.put('/:id/read', authenticate, markRead);

module.exports = router;
