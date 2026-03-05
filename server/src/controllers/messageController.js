const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// GET /api/messages/conversations — List user's conversations
const getConversations = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const conversations = await prisma.conversation.findMany({
            where: { participants: { some: { userId } } },
            orderBy: { updatedAt: 'desc' },
            include: {
                participants: {
                    include: { user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } },
                },
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
        });
        res.json({ success: true, conversations });
    } catch (err) { next(err); }
};

// POST /api/messages/conversations — Create or get existing conversation
const createConversation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { recipientId } = req.body;
        if (!recipientId) throw new AppError('Recipient ID required', 400);
        if (recipientId === userId) throw new AppError('Cannot message yourself', 400);

        // Check for existing 1-on-1 conversation
        const existing = await prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { userId } } },
                    { participants: { some: { userId: recipientId } } },
                ],
            },
            include: { participants: { include: { user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } } } },
        });
        if (existing) return res.json({ success: true, conversation: existing });

        const conversation = await prisma.conversation.create({
            data: {
                participants: {
                    create: [{ userId }, { userId: recipientId }],
                },
            },
            include: { participants: { include: { user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } } } },
        });
        res.status(201).json({ success: true, conversation });
    } catch (err) { next(err); }
};

// GET /api/messages/:conversationId — Get messages
const getMessages = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;

        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit, take: limit,
            include: { sender: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } },
        });

        res.json({ success: true, messages: messages.reverse(), page });
    } catch (err) { next(err); }
};

// POST /api/messages/:conversationId — Send message
const sendMessage = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { text, mediaUrl } = req.body;
        if (!text?.trim() && !mediaUrl) throw new AppError('Message text or media required', 400);

        const message = await prisma.message.create({
            data: {
                conversationId,
                senderId: req.user.id,
                text: text?.trim() || null,
                mediaUrl: mediaUrl || null,
            },
            include: { sender: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } },
        });

        // Update conversation timestamp
        await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

        res.status(201).json({ success: true, message });
    } catch (err) { next(err); }
};

module.exports = { getConversations, createConversation, getMessages, sendMessage };
