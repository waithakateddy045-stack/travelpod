const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getNotifications, markAllRead, markRead } = require('../controllers/notificationController');

router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const count = await prisma.notification.count({
            where: { userId: req.user.id, readAt: null }
        });
        res.json({ success: true, count });
    } catch {
        res.status(500).json({ success: false });
    }
});
router.put('/read-all', authenticate, markAllRead);
router.put('/:id/read', authenticate, markRead);

module.exports = router;
