const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../utils/prisma');
const { getNotifications, markAllRead, markRead } = require('../controllers/notificationController');

router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [notifCount, convs] = await Promise.all([
            prisma.notification.count({
                where: { userId, readAt: null }
            }),
            prisma.conversation.findMany({
                where: {
                    OR: [
                        { participant1Id: userId, unreadCountP1: { gt: 0 } },
                        { participant2Id: userId, unreadCountP2: { gt: 0 } }
                    ]
                },
                select: { participant1Id: true, unreadCountP1: true, unreadCountP2: true }
            })
        ]);

        let msgCount = 0;
        convs.forEach(c => {
            msgCount += c.participant1Id === userId ? c.unreadCountP1 : c.unreadCountP2;
        });

        res.json({ success: true, count: notifCount + msgCount, notifications: notifCount, messages: msgCount });
    } catch (err) {
        console.error('Unread count error:', err);
        res.status(500).json({ success: false });
    }
});
router.put('/read-all', authenticate, markAllRead);
router.put('/:id/read', authenticate, markRead);

module.exports = router;
