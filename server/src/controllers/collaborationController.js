const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

// POST /api/collaborations — Create a collaboration post
const createCollaboration = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { title, description, requirements, compensation, location, deadline } = req.body;
        if (!title) throw new AppError('Title is required', 400);

        const collab = await prisma.collaborationPost.create({
            data: {
                userId, title: title.trim(),
                description: description?.trim() || null,
                requirements: requirements || [],
                compensation: compensation?.trim() || null,
                location: location?.trim() || null,
                deadline: deadline ? new Date(deadline) : null,
            },
        });
        res.status(201).json({ success: true, collaboration: collab });
    } catch (err) { next(err); }
};

// GET /api/collaborations
const getCollaborations = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [collabs, total] = await Promise.all([
            prisma.collaborationPost.findMany({
                where: { status: 'OPEN' },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit, take: limit,
                include: { user: { select: { profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } },
            }),
            prisma.collaborationPost.count({ where: { status: 'OPEN' } }),
        ]);
        res.json({ success: true, collaborations: collabs, total, page });
    } catch (err) { next(err); }
};

// POST /api/collaborations/:id/apply
const applyToCollaboration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        const application = await prisma.collaborationApplication.create({
            data: { collaborationPostId: id, applicantId: req.user.id, message: message?.trim() || null },
        });
        res.status(201).json({ success: true, application });
    } catch (err) { next(err); }
};

module.exports = { createCollaboration, getCollaborations, applyToCollaboration };
