const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// GET /api/enquiries
// Returns enquiries relevant to the current user (sent if traveler, received if business)
const getEnquiries = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const accountType = req.user.accountType;

        const isBusiness = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'].includes(accountType);

        // If admin, return all (maybe for moderation later), but for now we scope to the user
        const whereClause = isBusiness ? { businessId: userId } : { travelerId: userId };

        const enquiries = await prisma.enquiry.findMany({
            where: whereClause,
            orderBy: { submittedAt: 'desc' },
            include: {
                traveler: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                business: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                response: true
            }
        });

        res.json({ success: true, enquiries });
    } catch (err) { next(err); }
};

// POST /api/enquiries
// A traveler creates a new enquiry for a business
const createEnquiry = async (req, res, next) => {
    try {
        const travelerId = req.user.id;
        const { businessId, travelDates, groupSize, budgetRange, requirements, message } = req.body;

        if (!businessId || !travelDates || !groupSize || !budgetRange || !message) {
            throw new AppError('Missing required fields for enquiry', 400);
        }

        if (travelerId === businessId) throw new AppError('Cannot enquiry yourself', 400);

        const enquiry = await prisma.enquiry.create({
            data: {
                travelerId,
                businessId,
                travelDates,
                groupSize: parseInt(groupSize),
                budgetRange,
                requirements: requirements || null,
                message,
                status: 'PENDING'
            }
        });

        // Trigger Notification
        const { createNotification } = require('./notificationController');
        createNotification({
            userId: businessId,
            type: 'new_enquiry',
            title: 'New Booking Enquiry!',
            body: 'A traveler has sent you a new enquiry.',
            relatedEntityId: enquiry.id,
            relatedEntityType: 'enquiry',
        }).catch(() => { });

        res.status(201).json({ success: true, enquiry });
    } catch (err) { next(err); }
};

// POST /api/enquiries/:id/respond
// A business responds to an enquiry, turning it into a DM thread
const respondToEnquiry = async (req, res, next) => {
    try {
        const businessId = req.user.id;
        const { id } = req.params;
        const { content } = req.body;

        if (!content) throw new AppError('Response content is required', 400);

        const enquiry = await prisma.enquiry.findUnique({ where: { id } });
        if (!enquiry) throw new AppError('Enquiry not found', 404);
        if (enquiry.businessId !== businessId) throw new AppError('Unauthorized', 403);
        if (enquiry.status !== 'PENDING') throw new AppError('Enquiry is already answered or closed', 400);

        // 1. Create the EnquiryResponse
        const responseData = await prisma.enquiryResponse.create({
            data: {
                enquiryId: id,
                businessId,
                content
            }
        });

        // 2. Update Enquiry Status
        await prisma.enquiry.update({
            where: { id },
            data: { status: 'REPLIED' }
        });

        // 3. (Optional but good UX) Also send it as a direct message so conversation can continue
        const p1 = businessId < enquiry.travelerId ? businessId : enquiry.travelerId;
        const p2 = businessId < enquiry.travelerId ? enquiry.travelerId : businessId;

        let conversation = await prisma.conversation.findUnique({
            where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: { participant1Id: p1, participant2Id: p2, lastMessageAt: new Date() }
            });
        }

        // The auto-generated context message
        const systemMessageText = `[Enquiry Update]\nI've replied to your booking enquiry regarding: ${enquiry.travelDates} (Group of ${enquiry.groupSize}).\n\nResponse: ${content}`;

        await prisma.directMessage.create({
            data: { conversationId: conversation.id, senderId: businessId, content: systemMessageText }
        });

        // Update unread counts
        const isSenderP1 = conversation.participant1Id === businessId;
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessagePreview: systemMessageText.substring(0, 50),
                lastMessageAt: new Date(),
                unreadCountP1: isSenderP1 ? undefined : { increment: 1 },
                unreadCountP2: isSenderP1 ? { increment: 1 } : undefined
            }
        });

        res.status(201).json({ success: true, response: responseData });
    } catch (err) { next(err); }
};

// PUT /api/enquiries/:id/status
const updateEnquiryStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { status } = req.body; // 'DECLINED', 'CLOSED'

        if (!['DECLINED', 'CLOSED'].includes(status)) {
            throw new AppError('Invalid status update', 400);
        }

        const enquiry = await prisma.enquiry.findUnique({ where: { id } });
        if (!enquiry) throw new AppError('Not found', 404);
        if (enquiry.businessId !== userId && enquiry.travelerId !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        const updated = await prisma.enquiry.update({
            where: { id },
            data: { status }
        });

        res.json({ success: true, enquiry: updated });
    } catch (err) { next(err); }
};

module.exports = { getEnquiries, createEnquiry, respondToEnquiry, updateEnquiryStatus };
