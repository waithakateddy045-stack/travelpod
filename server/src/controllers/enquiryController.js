const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// GET /api/enquiries
// Returns booking enquiries relevant to the current user
const getEnquiries = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const accountType = req.user.accountType;

        const isBusiness = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'].includes(
            accountType
        );

        const whereClause = isBusiness ? { receiverId: userId } : { senderId: userId };

        const rows = await prisma.bookingEnquiry.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                sender: true,
                receiver: true,
            },
        });

        const enquiries = rows.map((e) => {
            const travelerUser = e.sender;
            const businessUser = e.receiver;

            const traveler = {
                id: travelerUser.id,
                profile: {
                    displayName: travelerUser.displayName || travelerUser.username || 'Traveler',
                    handle: travelerUser.username,
                    avatarUrl: travelerUser.avatarUrl,
                },
            };

            const business = {
                id: businessUser.id,
                profile: {
                    displayName: businessUser.displayName || businessUser.username || 'Business',
                    handle: businessUser.username,
                    avatarUrl: businessUser.avatarUrl,
                },
            };

            return {
                id: e.id,
                status: e.status,
                travelDates: e.travelDates || '',
                groupSize: null,
                budgetRange: e.budget || 'Flexible',
                requirements: null,
                message: e.message,
                submittedAt: e.createdAt,
                traveler,
                business,
                response: null,
            };
        });

        res.json({ success: true, enquiries });
    } catch (err) {
        next(err);
    }
};

// POST /api/enquiries
// A traveler creates a new booking enquiry for a business
const createEnquiry = async (req, res, next) => {
    try {
        const senderId = req.user.id;
        const { businessId, travelDates, groupSize, budgetRange, requirements, message } = req.body;

        if (!businessId || !message) {
            throw new AppError('businessId and message are required', 400);
        }

        if (senderId === businessId) throw new AppError('Cannot enquiry yourself', 400);

        const bookingEnquiry = await prisma.bookingEnquiry.create({
            data: {
                senderId,
                receiverId: businessId,
                travelDates,
                budget: budgetRange,
                message: requirements
                    ? `${message}\n\nSpecial requirements: ${requirements} (Group size: ${groupSize || 'n/a'})`
                    : `${message} (Group size: ${groupSize || 'n/a'})`,
            },
            include: {
                sender: true,
                receiver: true,
            },
        });

        // Trigger Notification
        const { createNotification } = require('./notificationController');
        createNotification({
            userId: businessId,
            type: 'new_enquiry',
            title: 'New Booking Enquiry!',
            body: 'A traveler has sent you a new enquiry.',
            relatedEntityId: bookingEnquiry.id,
            relatedEntityType: 'booking_enquiry',
        }).catch(() => { });

        res.status(201).json({ success: true, enquiry: bookingEnquiry });
    } catch (err) {
        next(err);
    }
};

// POST /api/enquiries/:id/respond
// A business responds to an enquiry and starts a direct message thread
const respondToEnquiry = async (req, res, next) => {
    try {
        const businessId = req.user.id;
        const { id } = req.params;
        const { content } = req.body;

        if (!content) throw new AppError('Response content is required', 400);

        const enquiry = await prisma.bookingEnquiry.findUnique({ where: { id } });
        if (!enquiry) throw new AppError('Enquiry not found', 404);
        if (enquiry.receiverId !== businessId) throw new AppError('Unauthorized', 403);
        if (enquiry.status !== 'PENDING') throw new AppError('Enquiry has already been replied to', 400);

        const travelerId = enquiry.senderId;

        // Create or reuse a conversation between business and traveler
        let conversation = await prisma.conversation.findFirst({
            where: {
                participants: {
                    some: { userId: businessId },
                },
                AND: {
                    participants: {
                        some: { userId: travelerId },
                    },
                },
            },
            include: { participants: true },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    participants: {
                        create: [{ userId: businessId }, { userId: travelerId }],
                    },
                },
                include: { participants: true },
            });
        }

        const systemMessageText = `[Enquiry Update]\nI've replied to your booking enquiry regarding: ${enquiry.travelDates || 'your requested dates'
            }.\n\nResponse: ${content}`;

        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: businessId,
                content: systemMessageText,
            },
        });

        // Update enquiry status
        const updatedEnquiry = await prisma.bookingEnquiry.update({
            where: { id },
            data: { status: 'REPLIED' },
        });

        res.status(201).json({
            success: true,
            response: {
                id: message.id,
                content: message.content,
                createdAt: message.createdAt,
            },
            enquiry: updatedEnquiry,
        });
    } catch (err) {
        next(err);
    }
};

// PUT /api/enquiries/:id/status
const updateEnquiryStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { status } = req.body; // 'REPLIED' or 'CLOSED'

        if (!['REPLIED', 'CLOSED'].includes(status)) {
            throw new AppError('Invalid status. Use REPLIED or CLOSED.', 400);
        }

        const enquiry = await prisma.bookingEnquiry.findUnique({ where: { id } });
        if (!enquiry) throw new AppError('Not found', 404);
        if (enquiry.receiverId !== userId && enquiry.senderId !== userId) {
            throw new AppError('Unauthorized', 403);
        }

        const updated = await prisma.bookingEnquiry.update({
            where: { id },
            data: { status },
        });

        res.json({ success: true, enquiry: updated });
    } catch (err) {
        next(err);
    }
};

module.exports = { getEnquiries, createEnquiry, respondToEnquiry, updateEnquiryStatus };
