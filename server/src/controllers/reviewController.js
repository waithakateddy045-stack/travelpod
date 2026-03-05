const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/reviews — Submit a video review
const submitReview = async (req, res, next) => {
    try {
        const { postId, businessId, starRating, visitDate, serviceCategories } = req.body;
        const reviewerId = req.user.id;

        if (!postId || !businessId || !starRating) {
            throw new AppError('Post ID, business ID, and star rating are required', 400);
        }
        if (starRating < 1 || starRating > 5) throw new AppError('Star rating must be 1-5', 400);

        const existing = await prisma.videoReview.findFirst({ where: { postId, reviewerId } });
        if (existing) throw new AppError('You already reviewed this post', 409);

        const review = await prisma.videoReview.create({
            data: {
                postId, reviewerId, businessId,
                starRating: parseInt(starRating),
                visitDate: visitDate ? new Date(visitDate) : null,
                serviceCategories: serviceCategories || [],
            },
        });

        // Update business star rating average
        const avgResult = await prisma.videoReview.aggregate({
            where: { businessId, moderationStatus: 'APPROVED' },
            _avg: { starRating: true }, _count: true,
        });
        await prisma.businessProfile.updateMany({
            where: { profile: { userId: businessId } },
            data: {
                starRating: avgResult._avg.starRating || 0,
                verifiedReviewCount: avgResult._count || 0,
            },
        });

        res.status(201).json({ success: true, review });
    } catch (err) { next(err); }
};

// GET /api/reviews/business/:businessId
const getBusinessReviews = async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const [reviews, total] = await Promise.all([
            prisma.videoReview.findMany({
                where: { businessId, moderationStatus: 'APPROVED' },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit, take: limit,
                include: {
                    post: { select: { id: true, title: true, thumbnailUrl: true, videoUrl: true } },
                    reviewer: { select: { profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
                    reviewResponse: true,
                },
            }),
            prisma.videoReview.count({ where: { businessId, moderationStatus: 'APPROVED' } }),
        ]);

        res.json({ success: true, reviews, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// POST /api/reviews/:reviewId/respond — Business response
const respondToReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params;
        const { text } = req.body;
        if (!text?.trim()) throw new AppError('Response text is required', 400);

        const review = await prisma.videoReview.findUnique({ where: { id: reviewId } });
        if (!review) throw new AppError('Review not found', 404);
        if (review.businessId !== req.user.id) throw new AppError('Not your review to respond to', 403);

        const response = await prisma.reviewResponse.upsert({
            where: { reviewId },
            create: { reviewId, businessId: req.user.id, text: text.trim() },
            update: { text: text.trim() },
        });

        res.json({ success: true, response });
    } catch (err) { next(err); }
};

// POST /api/reviews/:reviewId/dispute
const disputeReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params;
        const { reason } = req.body;
        if (!reason?.trim()) throw new AppError('Dispute reason is required', 400);

        const review = await prisma.videoReview.findUnique({ where: { id: reviewId } });
        if (!review) throw new AppError('Review not found', 404);
        if (review.businessId !== req.user.id) throw new AppError('Only the reviewed business can dispute', 403);

        const dispute = await prisma.reviewDispute.create({
            data: { reviewId, businessId: req.user.id, reason: reason.trim() },
        });

        res.status(201).json({ success: true, dispute });
    } catch (err) { next(err); }
};

module.exports = { submitReview, getBusinessReviews, respondToReview, disputeReview };
