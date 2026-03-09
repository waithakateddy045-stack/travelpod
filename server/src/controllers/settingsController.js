const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');
const { uploadImage } = require('../services/cloudinary');
const fs = require('fs');

console.log('☁️ Settings loaded. Cloudinary status:', {
    cloud: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING',
    key: process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING'
});

// GET /api/settings — Get user settings
const getSettings = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, email: true, accountType: true, onboardingComplete: true, createdAt: true,
                profile: { select: { displayName: true, handle: true, bio: true, avatarUrl: true, personalityTags: true, preferredRegions: true, contentPreferences: true } },
            },
        });
        res.json({ success: true, user });
    } catch (err) { next(err); }
};

// PUT /api/settings/email
const updateEmail = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) throw new AppError('Email and current password required', 400);

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) throw new AppError('Incorrect password', 401);

        await prisma.user.update({ where: { id: req.user.id }, data: { email } });
        res.json({ success: true, message: 'Email updated' });
    } catch (err) { next(err); }
};

// PUT /api/settings/password
const updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) throw new AppError('Both passwords required', 400);
        if (newPassword.length < 8) throw new AppError('New password must be at least 8 characters', 400);

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
        if (!valid) throw new AppError('Current password is incorrect', 401);

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: req.user.id }, data: { hashedPassword: hash } });
        res.json({ success: true, message: 'Password updated' });
    } catch (err) { next(err); }
};

// PUT /api/settings/social — Update business social links
const updateSocialLinks = async (req, res, next) => {
    try {
        const BUSINESS_TYPES = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { profile: true }
        });
        if (!BUSINESS_TYPES.includes(user.accountType)) throw new AppError('Only business accounts can set social links', 403);

        const { instagramUrl, facebookUrl, linkedinUrl, whatsappPhone } = req.body;

        await prisma.businessProfile.update({
            where: { profileId: user.profile.id },
            data: {
                instagramUrl: instagramUrl?.trim() || null,
                facebookUrl: facebookUrl?.trim() || null,
                linkedinUrl: linkedinUrl?.trim() || null,
                whatsappPhone: whatsappPhone?.trim() || null,
            }
        });
        res.json({ success: true, message: 'Social links updated' });
    } catch (err) { next(err); }
};

// DELETE /api/settings/account — Soft delete account
const deleteAccount = async (req, res, next) => {
    try {
        const { password } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user.hashedPassword) {
            const valid = await bcrypt.compare(password, user.hashedPassword);
            if (!valid) throw new AppError('Incorrect password', 401);
        }

        await prisma.user.update({ where: { id: req.user.id }, data: { isDeleted: true } });
        res.json({ success: true, message: 'Account deleted' });
    } catch (err) { next(err); }
};

// PUT /api/settings/profile
const updateProfile = async (req, res, next) => {
    try {
        const { displayName, handle, bio, description, personalityTags, preferredRegions } = req.body;
        const userId = req.user.id;

        // 1. Handle uniqueness check if changing
        if (handle) {
            const existing = await prisma.profile.findFirst({
                where: { handle: { equals: handle.trim(), mode: 'insensitive' }, userId: { not: userId } }
            });
            if (existing) throw new AppError('Handle is already taken', 400);
        }

        // 2. Update Profile
        const profile = await prisma.profile.update({
            where: { userId },
            data: {
                ...(displayName && { displayName: displayName.trim() }),
                ...(handle && { handle: handle.trim().toLowerCase() }),
                ...(bio !== undefined && { bio: bio?.trim() || null }),
                ...(personalityTags && { personalityTags }),
                ...(preferredRegions && { preferredRegions }),
            }
        });

        // 3. Update Business Profile description if provided
        if (description !== undefined) {
            await prisma.businessProfile.updateMany({
                where: { profileId: profile.id },
                data: { description: description?.trim() || null }
            });
        }

        res.json({ success: true, message: 'Profile updated' });
    } catch (err) { next(err); }
};

// POST /api/settings/avatar
const updateAvatar = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('No image file provided', 400);
        }
        console.log('📸 Uploading avatar for user:', req.user.id, 'at path:', req.file.path);
        const upload = await uploadImage(req.file.path, 'travelpod/avatars');
        console.log('✅ Cloudinary upload success:', upload.secure_url);

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        await prisma.profile.update({
            where: { userId: req.user.id },
            data: { avatarUrl: upload.secure_url }
        });

        res.json({ success: true, avatarUrl: upload.secure_url });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        next(err);
    }
};

module.exports = { getSettings, updateEmail, updatePassword, deleteAccount, updateSocialLinks, updateProfile, updateAvatar };
