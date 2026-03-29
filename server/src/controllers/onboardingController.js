const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadImage } = require('../services/cloudinary');
const fs = require('fs');

// ============================================================
// POST /api/onboarding/profile
// Step 1 — Create or update the user's basic profile fields on User
// ============================================================
const saveProfile = async (req, res, next) => {
    try {
        const { displayName, handle, personalityTags, preferredRegions, contentPreferences } = req.body;
        const userId = req.user.id;

        if (!displayName || !handle) {
            throw new AppError('Display name and handle are required', 400);
        }

        // Validate handle format: lowercase, alphanumeric + underscores, 3–30 chars
        const handleRegex = /^[a-z0-9_]{3,30}$/;
        if (!handleRegex.test(handle)) {
            throw new AppError('Handle must be 3–30 characters, lowercase letters, numbers, and underscores only', 400);
        }

        // Ensure username (used as handle) is unique
        const existing = await prisma.user.findUnique({ where: { username: handle } });
        if (existing && existing.id !== userId) {
            throw new AppError('This handle is already taken', 409);
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                displayName,
                username: handle,
                personalityTags: personalityTags || [],
                preferredRegions: preferredRegions || [],
                // contentPreferences can be folded into personalityTags for now
            },
            select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                accountType: true,
                personalityTags: true,
                preferredRegions: true,
                onboardingComplete: true,
            },
        });

        res.json({ success: true, profile: user });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/onboarding/avatar
// Step 2 — Upload avatar (handled via multer + Cloudinary)
// ============================================================
const uploadAvatar = async (req, res, next) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            throw new AppError('No avatar file uploaded', 400);
        }

        const { signedUrl: avatarSignedUrl } = await uploadImage(req.file.path, 'travelpod/avatars');

        try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {}

        const avatarUrl = avatarSignedUrl;

        await prisma.user.update({
            where: { id: userId },
            data: { avatarUrl },
        });

        res.json({ success: true, avatarUrl });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        next(err);
    }
};

// ============================================================
// POST /api/onboarding/business
// Step 3 — Business-specific details stored on User
// ============================================================
const saveBusinessProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { country, description, websiteUrl } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                websiteUrl: websiteUrl || null,
                bio: description || null,
                // country is not a first-class field; could be encoded into preferredRegions
            },
            select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                websiteUrl: true,
                bio: true,
            },
        });

        res.json({ success: true, businessProfile: user });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/onboarding/complete
// Mark onboarding as done
// ============================================================
const completeOnboarding = async (req, res, next) => {
    try {
        const userId = req.user.id;

        await prisma.user.update({
            where: { id: userId },
            data: { onboardingComplete: true },
        });

        res.json({ success: true, message: 'Onboarding complete! Welcome to Travelpod.' });
    } catch (err) {
        next(err);
    }
};

module.exports = { saveProfile, uploadAvatar, saveBusinessProfile, completeOnboarding };
