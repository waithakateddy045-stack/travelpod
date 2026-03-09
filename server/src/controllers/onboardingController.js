const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadImage } = require('../services/cloudinary');
const fs = require('fs');

// ============================================================
// POST /api/onboarding/profile
// Step 1 — Create or update the user's profile
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

        // Check handle uniqueness
        const existingHandle = await prisma.profile.findUnique({ where: { handle } });
        if (existingHandle && existingHandle.userId !== userId) {
            throw new AppError('This handle is already taken', 409);
        }

        // Upsert profile
        const profile = await prisma.profile.upsert({
            where: { userId },
            create: {
                userId,
                displayName,
                handle,
                personalityTags: personalityTags || [],
                preferredRegions: preferredRegions || [],
                contentPreferences: contentPreferences || [],
            },
            update: {
                displayName,
                handle,
                personalityTags: personalityTags || [],
                preferredRegions: preferredRegions || [],
                contentPreferences: contentPreferences || [],
            },
        });

        res.json({ success: true, profile });
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

        console.log('📸 Uploading onboarding avatar for user:', userId);
        const upload = await uploadImage(req.file.path, 'travelpod/avatars');
        
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        const avatarUrl = upload.secure_url;

        await prisma.profile.update({
            where: { userId },
            data: { avatarUrl },
        });

        res.json({ success: true, avatarUrl });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/onboarding/business
// Step 3 — Business-specific details (agencies, hotels, etc.)
// ============================================================
const saveBusinessProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { country, description, websiteUrl } = req.body;

        const profile = await prisma.profile.findUnique({ where: { userId } });
        if (!profile) {
            throw new AppError('Please complete step 1 first', 400);
        }

        // Upsert business profile
        const businessProfile = await prisma.businessProfile.upsert({
            where: { profileId: profile.id },
            create: {
                profileId: profile.id,
                country: country || null,
                description: description || null,
                websiteUrl: websiteUrl || null,
            },
            update: {
                country: country || null,
                description: description || null,
                websiteUrl: websiteUrl || null,
            },
        });

        res.json({ success: true, businessProfile });
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

        // Verify profile exists
        const profile = await prisma.profile.findUnique({ where: { userId } });
        if (!profile) {
            throw new AppError('Please complete your profile first', 400);
        }

        await prisma.user.update({
            where: { id: userId },
            data: { onboardingComplete: true },
        });

        // ── Auto-follow the official @travelpod account ──
        try {
            const officialProfile = await prisma.profile.findUnique({ where: { handle: 'travelpod' } });
            if (officialProfile && officialProfile.userId !== userId) {
                const alreadyFollowing = await prisma.follow.findUnique({
                    where: { followerId_followingId: { followerId: userId, followingId: officialProfile.userId } },
                });
                if (!alreadyFollowing) {
                    await prisma.follow.create({
                        data: { followerId: userId, followingId: officialProfile.userId },
                    });
                    // Update counts
                    await prisma.profile.update({
                        where: { userId: officialProfile.userId },
                        data: { followerCount: { increment: 1 } },
                    });
                    await prisma.profile.update({
                        where: { userId },
                        data: { followingCount: { increment: 1 } },
                    });
                }
            }
        } catch (autoFollowErr) {
            // Non-critical — don't block onboarding if this fails
            console.warn('Auto-follow @travelpod failed (non-critical):', autoFollowErr.message);
        }

        res.json({ success: true, message: 'Onboarding complete! Welcome to Travelpod.' });
    } catch (err) {
        next(err);
    }
};

module.exports = { saveProfile, uploadAvatar, saveBusinessProfile, completeOnboarding };
