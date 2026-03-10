const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// GET /api/messages/conversations
const getConversations = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const conversations = await prisma.conversation.findMany({
            where: {
                OR: [
                    { participant1Id: userId },
                    { participant2Id: userId }
                ]
            },
            orderBy: { lastMessageAt: 'desc' },
            include: {
                participant1: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } }, accountType: true } },
                participant2: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } }, accountType: true } }
            }
        });

        // Format for frontend
        const formatted = conversations.map(c => {
            const isP1 = c.participant1Id === userId;
            return {
                id: c.id,
                otherUser: isP1 ? c.participant2 : c.participant1,
                lastMessagePreview: c.lastMessagePreview,
                lastMessageAt: c.lastMessageAt,
                unreadCount: isP1 ? c.unreadCountP1 : c.unreadCountP2,
                createdAt: c.createdAt
            };
        });

        res.json({ success: true, conversations: formatted });
    } catch (err) { next(err); }
};

// GET /api/messages/:conversationId
const getMessages = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;

        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) throw new AppError('Conversation not found', 404);
        if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        const messages = await prisma.directMessage.findMany({
            where: { conversationId },
            orderBy: { sentAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        });

        // Mark read
        const isP1 = conversation.participant1Id === userId;
        if ((isP1 && conversation.unreadCountP1 > 0) || (!isP1 && conversation.unreadCountP2 > 0)) {
            await prisma.conversation.update({
                where: { id: conversationId },
                data: isP1 ? { unreadCountP1: 0 } : { unreadCountP2: 0 }
            });
            await prisma.directMessage.updateMany({
                where: { conversationId, senderId: { not: userId }, readAt: null },
                data: { readAt: new Date() }
            });
        }

        res.json({ success: true, messages: messages.reverse(), page });
    } catch (err) { next(err); }
};

// POST /api/messages
const sendMessage = async (req, res, next) => {
    try {
        const senderId = req.user.id;
        const { recipientId, content } = req.body;

        if (!recipientId || !content) throw new AppError('Recipient and content required', 400);
        if (senderId === recipientId) throw new AppError('Cannot message yourself', 400);

        const p1 = senderId < recipientId ? senderId : recipientId;
        const p2 = senderId < recipientId ? recipientId : senderId;

        let conversation = await prisma.conversation.findUnique({
            where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: { participant1Id: p1, participant2Id: p2, lastMessageAt: new Date() }
            });
        }

        const message = await prisma.directMessage.create({
            data: { conversationId: conversation.id, senderId, content }
        });

        const isSenderP1 = conversation.participant1Id === senderId;
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessagePreview: content.substring(0, 50),
                lastMessageAt: new Date(),
                unreadCountP1: isSenderP1 ? undefined : { increment: 1 },
                unreadCountP2: isSenderP1 ? { increment: 1 } : undefined
            }
        });

        res.status(201).json({ success: true, message, conversationId: conversation.id });
    } catch (err) { next(err); }
};

const getUnreadMessageCount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const conversations = await prisma.conversation.findMany({
            where: {
                OR: [
                    { participant1Id: userId, unreadCountP1: { gt: 0 } },
                    { participant2Id: userId, unreadCountP2: { gt: 0 } }
                ]
            },
            select: { participant1Id: true, unreadCountP1: true, unreadCountP2: true }
        });

        const totalUnread = conversations.reduce((acc, c) => {
            return acc + (c.participant1Id === userId ? c.unreadCountP1 : c.unreadCountP2);
        }, 0);

        res.json({ success: true, count: totalUnread });
    } catch (err) { next(err); }
};

module.exports = { getConversations, getMessages, sendMessage, getUnreadMessageCount };
