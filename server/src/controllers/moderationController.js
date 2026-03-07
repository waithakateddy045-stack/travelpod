const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/reports — Report content or account
const reportEntity = async (req, res, next) => {
    try {
        const { entityType, entityId, reason, detail, postId } = req.body;
        if (!entityType || !entityId || !reason) throw new AppError('entityType, entityId, and reason required', 400);

        // Validate reason is a valid ReportReason enum
        const validReasons = ['MISLEADING', 'INAPPROPRIATE', 'SPAM', 'FAKE_REVIEW', 'HARASSMENT'];
        if (!validReasons.includes(reason)) throw new AppError('Invalid reason. Must be one of: ' + validReasons.join(', '), 400);

        try {
            const report = await prisma.report.create({
                data: {
                    reporterId: req.user.id,
                    entityType, // 'POST', 'USER', 'COMMENT', 'REVIEW'
                    entityId,
                    reason, // ReportReason enum
                    detail,
                    postId: postId || (entityType === 'POST' ? entityId : null),
                },
            });
            return res.status(201).json({ success: true, report });
        } catch (dbErr) {
            // Fail-safe: If the 'detail' column is missing in the DB (schema sync issue),
            // retry the creation without it so the report still goes through.
            // Prisma code P2021 is "The table `...` does not exist", 
            // but column mismatches often show as general Prisma errors or specific field errors.
            if (dbErr.code === 'P2002' || dbErr.message.includes('Unknown arg `detail`')) {
                console.warn('Falling back to report creation without detail field due to schema mismatch');
                const report = await prisma.report.create({
                    data: {
                        reporterId: req.user.id,
                        entityType,
                        entityId,
                        reason,
                        postId: postId || (entityType === 'POST' ? entityId : null),
                    },
                });
                return res.status(201).json({ success: true, report, warning: 'detail_omitted' });
            }
            throw dbErr; // Re-throw if it's a different error
        }
    } catch (err) { next(err); }
};

// GET /api/reports — Admin: list reports
const getReports = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    reporter: { select: { profile: { select: { displayName: true, handle: true } } } },
                    post: { select: { id: true, title: true, videoUrl: true, thumbnailUrl: true } },
                },
            }),
            prisma.report.count(),
        ]);

        // Manually enrich for Comments and Users if needed
        const enriched = await Promise.all(reports.map(async (r) => {
            if (r.entityType === 'COMMENT') {
                const comment = await prisma.comment.findUnique({
                    where: { id: r.entityId },
                    select: { content: true, user: { select: { profile: { select: { handle: true } } } } }
                });
                return { ...r, comment };
            }
            if (r.entityType === 'USER') {
                const user = await prisma.user.findUnique({
                    where: { id: r.entityId },
                    select: { profile: { select: { handle: true, displayName: true } } }
                });
                return { ...r, reportedUser: user };
            }
            return r;
        }));

        res.json({ success: true, reports: enriched, total, page });
    } catch (err) { next(err); }
};

// PUT /api/admin/reports/:id/resolve — Admin: delete the report (reports have no status field)
const resolveReport = async (req, res, next) => {
    try {
        // The Report model has no status/resolve fields — we simply delete or take action
        // Here we delete the report (action taken externally on the content)
        const report = await prisma.report.findUnique({ where: { id: req.params.id } });
        if (!report) throw new AppError('Report not found', 404);

        await prisma.report.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Report resolved and removed' });
    } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/suspend
const suspendUser = async (req, res, next) => {
    try {
        await prisma.user.update({ where: { id: req.params.id }, data: { isSuspended: true } });
        res.json({ success: true, message: 'User suspended' });
    } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/unsuspend
const unsuspendUser = async (req, res, next) => {
    try {
        await prisma.user.update({ where: { id: req.params.id }, data: { isSuspended: false } });
        res.json({ success: true, message: 'User unsuspended' });
    } catch (err) { next(err); }
};

module.exports = { reportEntity, getReports, resolveReport, suspendUser, unsuspendUser };
