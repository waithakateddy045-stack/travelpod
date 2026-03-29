const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadImage } = require('../services/cloudinary');

// ============================================================
// POST /api/verify/business/apply — Submit verification application
// ============================================================
const applyForVerification = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];
        if (!BUSINESS_TYPES.includes(user.accountType)) {
            throw new AppError('Only business accounts can apply for verification', 400);
        }

        // Check if already applied
        const existing = await prisma.businessVerification.findUnique({ where: { userId } });
        if (existing && existing.status === 'APPROVED') throw new AppError('Already verified', 400);
        if (existing && existing.status === 'PENDING') throw new AppError('Application already pending', 400);

        const {
            businessRegistrationNumber, businessRegistrationDocument,
            associationName, associationMembershipNumber, associationDocument,
            registeredWebsite,
        } = req.body;

        if (!businessRegistrationNumber?.trim()) throw new AppError('Registration number is required', 400);
        if (!businessRegistrationDocument?.trim()) throw new AppError('Registration document URL is required', 400);
        if (!registeredWebsite?.trim()) throw new AppError('Website is required', 400);

        const verification = await prisma.businessVerification.upsert({
            where: { userId },
            update: {
                businessRegistrationNumber: businessRegistrationNumber.trim(),
                businessRegistrationDocument: businessRegistrationDocument.trim(),
                associationName: associationName?.trim() || null,
                associationMembershipNumber: associationMembershipNumber?.trim() || null,
                associationDocument: associationDocument?.trim() || null,
                registeredWebsite: registeredWebsite.trim(),
                status: 'PENDING',
                adminNotes: null,
            },
            create: {
                userId,
                businessRegistrationNumber: businessRegistrationNumber.trim(),
                businessRegistrationDocument: businessRegistrationDocument.trim(),
                associationName: associationName?.trim() || null,
                associationMembershipNumber: associationMembershipNumber?.trim() || null,
                associationDocument: associationDocument?.trim() || null,
                registeredWebsite: registeredWebsite.trim(),
            },
        });

        res.status(201).json({ success: true, verification });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/verify/business/status — Check own status
// ============================================================
const getVerificationStatus = async (req, res, next) => {
    try {
        const verification = await prisma.businessVerification.findUnique({
            where: { userId: req.user.id },
        });
        res.json({ success: true, verification: verification || null });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/verify/business/:userId — Public verification details
// ============================================================
const getPublicVerification = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const verification = await prisma.businessVerification.findUnique({
            where: { userId },
        });

        if (!verification || verification.status !== 'APPROVED') {
            return res.json({ success: true, verified: false, verification: null });
        }

        // Return only public-safe fields
        res.json({
            success: true,
            verification: {
                businessRegistrationNumber: verification.businessRegistrationNumber,
                associationName: verification.associationName,
                associationMembershipNumber: verification.associationMembershipNumber,
                registeredWebsite: verification.registeredWebsite,
                websiteVerified: verification.websiteVerified,
                verifiedAt: verification.verifiedAt,
            },
        });
    } catch (err) { next(err); }
};

// ============================================================
// Admin — GET all verifications
// ============================================================
const getAdminVerifications = async (req, res, next) => {
    try {
        const status = req.query.status || 'PENDING';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;



        const [verifications, total] = await Promise.all([
            prisma.businessVerification.findMany({
                where: { status },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            accountType: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true,
                            isVerified: true,
                        },
                    },
                },
            }),
            prisma.businessVerification.count({ where: { status } }),
        ]);

        res.json({ success: true, verifications, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// ============================================================
// Admin — PATCH approve verification
// ============================================================
const approveVerification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { adminNotes, websiteVerified } = req.body;

        const [verification] = await prisma.$transaction([
            prisma.businessVerification.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    adminNotes: adminNotes || null,
                    websiteVerified: websiteVerified || false,
                    verifiedAt: new Date(),
                    verifiedByAdminId: req.user.id,
                },
            }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'APPROVE_VERIFICATION',
                    targetEntityType: 'BUSINESS_VERIFICATION',
                    targetEntityId: id,
                    reason: adminNotes || 'Approved'
                }
            })
        ]);

        // Also mark the underlying User as verified
        await prisma.user.update({
            where: { id: verification.userId },
            data: { isVerified: true },
        }).catch(() => {});

        res.json({ success: true, verification });
    } catch (err) { next(err); }
};

// ============================================================
// Admin — PATCH reject verification
// ============================================================
const rejectVerification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const [verification] = await prisma.$transaction([
            prisma.businessVerification.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    adminNotes: adminNotes || null,
                    verifiedByAdminId: req.user.id,
                },
            }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'REJECT_VERIFICATION',
                    targetEntityType: 'BUSINESS_VERIFICATION',
                    targetEntityId: id,
                    reason: adminNotes || 'Rejected'
                }
            })
        ]);

        res.json({ success: true, verification });
    } catch (err) { next(err); }
};

module.exports = {
    applyForVerification, getVerificationStatus, getPublicVerification,
    getAdminVerifications, approveVerification, rejectVerification,
};
