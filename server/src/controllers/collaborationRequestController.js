const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/collaborations — send collaboration request
const createCollaboration = async (req, res, next) => {
    try {
        const { receiverId, postId, proposal, contentIdea, proposedDates, compensationType } = req.body;
        if (!receiverId || !proposal) throw new AppError('receiverId and proposal required', 400);
        if (receiverId === req.user.id) throw new AppError('Cannot collaborate with yourself', 400);

        const collab = await prisma.collaborationRequest.create({
            data: {
                initiatorId: req.user.id,
                receiverId,
                postId: postId || null,
                proposal,
                contentIdea: contentIdea || null,
                proposedDates: proposedDates || null,
                compensationType: compensationType || 'EXPOSURE',
            },
        });

        // Send notification
        await prisma.notification.create({
            data: {
                userId: receiverId,
                type: 'COLLABORATION_REQUEST',
                title: 'New Collaboration Request',
                body: `You received a collaboration invitation!`,
                relatedEntityId: collab.id,
                relatedEntityType: 'COLLABORATION',
            },
        }).catch(() => {});

        res.status(201).json({ success: true, collaboration: collab });
    } catch (err) { next(err); }
};

// GET /api/collaborations — all sent and received
const getCollaborations = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const tab = req.query.tab || 'received'; // 'received' | 'sent'

        const where = tab === 'sent'
            ? { initiatorId: userId }
            : { receiverId: userId };

        const collabs = await prisma.collaborationRequest.findMany({
            where,
            include: {
                initiator: {
                    select: {
                        id: true, accountType: true,
                        profile: { select: { displayName: true, handle: true, avatarUrl: true, businessProfile: { select: { verificationStatus: true } } } },
                    },
                },
                receiver: {
                    select: {
                        id: true, accountType: true,
                        profile: { select: { displayName: true, handle: true, avatarUrl: true, businessProfile: { select: { verificationStatus: true } } } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, collaborations: collabs });
    } catch (err) { next(err); }
};

// GET /api/admin/collaborations — admin overview
const getAdminCollaborations = async (req, res, next) => {
    try {
        const collabs = await prisma.collaborationRequest.findMany({
            include: {
                initiator: { select: { id: true, profile: { select: { displayName: true, handle: true } } } },
                receiver: { select: { id: true, profile: { select: { displayName: true, handle: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, collaborations: collabs });
    } catch (err) { next(err); }
};

// PATCH /api/collaborations/:id/accept
const acceptCollaboration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
        if (!collab) throw new AppError('Collaboration not found', 404);
        if (collab.receiverId !== req.user.id) throw new AppError('Not authorized', 403);

        await prisma.collaborationRequest.update({
            where: { id },
            data: { status: 'ACCEPTED' },
        });

        // Auto-spawn DM thread
        const p1 = collab.initiatorId < collab.receiverId ? collab.initiatorId : collab.receiverId;
        const p2 = collab.initiatorId < collab.receiverId ? collab.receiverId : collab.initiatorId;

        const convo = await prisma.conversation.upsert({
            where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
            update: { lastMessagePreview: '🤝 Collaboration accepted! Let\'s chat.', lastMessageAt: new Date() },
            create: { participant1Id: p1, participant2Id: p2, lastMessagePreview: '🤝 Collaboration accepted! Let\'s chat.' },
        });

        await prisma.directMessage.create({
            data: {
                conversationId: convo.id,
                senderId: req.user.id,
                content: `🤝 I've accepted your collaboration request! Let's discuss the details.\n\nProposal: ${collab.proposal}`,
            },
        });

        // Notify initiator
        await prisma.notification.create({
            data: {
                userId: collab.initiatorId,
                type: 'COLLABORATION_ACCEPTED',
                title: 'Collaboration Accepted!',
                body: 'Your collaboration request was accepted! Check your messages.',
                relatedEntityId: id,
                relatedEntityType: 'COLLABORATION',
            },
        }).catch(() => {});

        res.json({ success: true, message: 'Collaboration accepted', conversationId: convo.id });
    } catch (err) { next(err); }
};

// PATCH /api/collaborations/:id/decline
const declineCollaboration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
        if (!collab) throw new AppError('Collaboration not found', 404);
        if (collab.receiverId !== req.user.id) throw new AppError('Not authorized', 403);

        await prisma.collaborationRequest.update({
            where: { id },
            data: { status: 'DECLINED', declineReason: reason || null },
        });

        res.json({ success: true, message: 'Collaboration declined' });
    } catch (err) { next(err); }
};

// PATCH /api/collaborations/:id/complete
const completeCollaboration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
        if (!collab) throw new AppError('Collaboration not found', 404);
        if (collab.initiatorId !== req.user.id && collab.receiverId !== req.user.id) {
            throw new AppError('Not authorized', 403);
        }

        await prisma.collaborationRequest.update({
            where: { id },
            data: { status: 'COMPLETED' },
        });

        res.json({ success: true, message: 'Collaboration marked as completed' });
    } catch (err) { next(err); }
};

module.exports = { createCollaboration, getCollaborations, getAdminCollaborations, acceptCollaboration, declineCollaboration, completeCollaboration };
