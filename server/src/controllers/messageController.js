const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// GET /api/messages/conversations
// Returns all conversations where the current user is a participant,
// including the other user and the latest message metadata.
const getConversations = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const participantRows = await prisma.conversationParticipant.findMany({
            where: { userId },
            include: {
                conversation: {
                    include: {
                        participants: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        username: true,
                                        displayName: true,
                                        avatarUrl: true,
                                        isVerified: true
                                    }
                                }
                            }
                        },
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });

        const conversationsUnsorted = await Promise.all(
            participantRows.map(async (row) => {
                const conversation = row.conversation;
                const otherParticipant = conversation.participants.find(
                    (p) => p.userId !== userId
                );
                const otherUser = otherParticipant?.user;

                const lastMessage = conversation.messages[0] || null;

                // Count unread messages for this user in this conversation
                const unreadCount = await prisma.message.count({
                    where: {
                        conversationId: conversation.id,
                        isRead: false,
                        senderId: { not: userId },
                    },
                });

                return {
                    id: conversation.id,
                    otherUser: otherUser
                        ? {
                            id: otherUser.id,
                            profile: {
                                displayName:
                                    otherUser.displayName ||
                                    otherUser.username ||
                                    'Traveler',
                                handle: otherUser.username,
                                avatarUrl: otherUser.avatarUrl,
                            },
                        }
                        : null,
                    lastMessagePreview: lastMessage
                        ? lastMessage.content.substring(0, 50)
                        : '',
                    lastMessageAt: lastMessage ? lastMessage.createdAt : conversation.createdAt,
                    unreadCount,
                    createdAt: conversation.createdAt,
                };
            })
        );

        const conversations = conversationsUnsorted.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        res.json({ success: true, conversations });
    } catch (err) {
        next(err);
    }
};

// GET /api/messages/:conversationId
const getMessages = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 30;

        const participant = await prisma.conversationParticipant.findFirst({
            where: { conversationId, userId },
        });
        if (!participant) throw new AppError('Conversation not found', 404);

        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        });

        // Mark all messages from others as read
        await prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: userId },
                isRead: false,
            },
            data: { isRead: true },
        });

        const shaped = messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            content: m.content,
            sentAt: m.createdAt,
        }));

        res.json({ success: true, messages: shaped, page });
    } catch (err) {
        next(err);
    }
};

// POST /api/messages
const sendMessage = async (req, res, next) => {
    try {
        const senderId = req.user.id;
        const { recipientId, content } = req.body;

        if (!recipientId || !content) throw new AppError('Recipient and content required', 400);
        if (senderId === recipientId) throw new AppError('Cannot message yourself', 400);

        let conversation = await prisma.conversation.findFirst({
            where: {
                participants: {
                    some: { userId: senderId },
                },
                AND: {
                    participants: {
                        some: { userId: recipientId },
                    },
                },
            },
            include: { participants: true },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    participants: {
                        create: [{ userId: senderId }, { userId: recipientId }],
                    },
                },
                include: { participants: true },
            });
        }

        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId,
                content,
            },
        });

        res.status(201).json({
            success: true,
            message: {
                id: message.id,
                senderId: message.senderId,
                content: message.content,
                sentAt: message.createdAt,
            },
            conversationId: conversation.id,
        });
    } catch (err) {
        next(err);
    }
};

const getUnreadMessageCount = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const totalUnread = await prisma.message.count({
            where: {
                isRead: false,
                senderId: { not: userId },
                conversation: {
                    participants: {
                        some: { userId },
                    },
                },
            },
        });

        res.json({ success: true, count: totalUnread });
    } catch (err) {
        next(err);
    }
};

module.exports = { getConversations, getMessages, sendMessage, getUnreadMessageCount };
