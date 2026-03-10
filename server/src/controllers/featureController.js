const prisma = require('../utils/prisma');

// GET /api/features
const getFeatures = async (_req, res, next) => {
    try {
        const features = await prisma.featureFlag.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                isEnabled: true,
                description: true,
            },
        });
        res.json({ success: true, features });
    } catch (err) {
        next(err);
    }
};

module.exports = { getFeatures };

const prisma = require('../utils/prisma');

// GET /api/features — public list of all feature flags
const getAllFeatures = async (req, res, next) => {
    try {
        const flags = await prisma.featureFlag.findMany({
            select: { name: true, isEnabled: true, description: true },
            orderBy: { name: 'asc' },
        });
        res.json({ success: true, features: flags });
    } catch (err) {
        // If table doesn't exist yet, return empty
        res.json({ success: true, features: [] });
    }
};

// PATCH /api/features/:name — admin toggle
const toggleFeature = async (req, res, next) => {
    try {
        const { name } = req.params;
        const { isEnabled } = req.body;

        const flag = await prisma.featureFlag.update({
            where: { name },
            data: { isEnabled: !!isEnabled },
        });

        // Audit log
        await prisma.adminActionLog.create({
            data: {
                adminId: req.user.id,
                actionType: 'CONTENT_RESTORE', // Reusing closest enum value
                targetEntityId: flag.id,
                targetEntityType: 'FEATURE_FLAG',
                reason: `Admin ${isEnabled ? 'enabled' : 'disabled'} feature: ${name}`,
            },
        });

        res.json({ success: true, feature: flag });
    } catch (err) { next(err); }
};

module.exports = { getAllFeatures, toggleFeature };
