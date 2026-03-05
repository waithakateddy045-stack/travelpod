const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');

// GET /api/settings — Get user settings
const getSettings = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, email: true, accountType: true, onboardingComplete: true, createdAt: true,
                profile: { select: { displayName: true, handle: true, avatarUrl: true, personalityTags: true, preferredRegions: true, contentPreferences: true } },
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
        const valid = await bcrypt.compare(password, user.passwordHash);
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
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) throw new AppError('Current password is incorrect', 401);

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash } });
        res.json({ success: true, message: 'Password updated' });
    } catch (err) { next(err); }
};

// DELETE /api/settings/account — Soft delete account
const deleteAccount = async (req, res, next) => {
    try {
        const { password } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new AppError('Incorrect password', 401);

        await prisma.user.update({ where: { id: req.user.id }, data: { isDeleted: true } });
        res.json({ success: true, message: 'Account deleted' });
    } catch (err) { next(err); }
};

module.exports = { getSettings, updateEmail, updatePassword, deleteAccount };
