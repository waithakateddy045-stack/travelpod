const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/enquiries — Submit enquiry to a business
const submitEnquiry = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { businessId, subject, message, enquiryType } = req.body;
        if (!businessId || !subject || !message) throw new AppError('Business ID, subject, and message are required', 400);

        const enquiry = await prisma.enquiry.create({
            data: {
                userId, businessId,
                subject: subject.trim(),
                message: message.trim(),
                enquiryType: enquiryType || 'GENERAL',
            },
        });
        res.status(201).json({ success: true, enquiry });
    } catch (err) { next(err); }
};

// GET /api/enquiries — Get enquiries (for business or user)
const getEnquiries = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.query.role || 'sender'; // 'sender' or 'receiver'
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const where = role === 'receiver' ? { businessId: userId } : { userId };
        const [enquiries, total] = await Promise.all([
            prisma.enquiry.findMany({
                where, orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit, take: limit,
                include: {
                    user: { select: { profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                    business: { select: { profile: { select: { displayName: true, handle: true } } } },
                },
            }),
            prisma.enquiry.count({ where }),
        ]);
        res.json({ success: true, enquiries, total, page });
    } catch (err) { next(err); }
};

// PUT /api/enquiries/:id/respond
const respondToEnquiry = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { response } = req.body;
        if (!response?.trim()) throw new AppError('Response is required', 400);

        const enquiry = await prisma.enquiry.findUnique({ where: { id } });
        if (!enquiry) throw new AppError('Enquiry not found', 404);
        if (enquiry.businessId !== req.user.id) throw new AppError('Not authorized', 403);

        const updated = await prisma.enquiry.update({
            where: { id },
            data: { response: response.trim(), status: 'RESPONDED', respondedAt: new Date() },
        });
        res.json({ success: true, enquiry: updated });
    } catch (err) { next(err); }
};

module.exports = { submitEnquiry, getEnquiries, respondToEnquiry };
