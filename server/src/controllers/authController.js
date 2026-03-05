const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 12;

/**
 * Generate JWT access token (7 days)
 */
const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            accountType: user.accountType,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );
};

/**
 * Generate refresh token (30 days)
 */
const generateRefreshToken = () => uuidv4();

/**
 * Store refresh token in DB with expiry
 */
const storeRefreshToken = async (userId, token) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.session.create({
        data: { userId, refreshToken: token, expiresAt },
    });
};

/**
 * Validate password strength
 * Min 8 chars, at least one number
 */
const validatePassword = (password) => {
    if (!password || password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400);
    }
    if (!/\d/.test(password)) {
        throw new AppError('Password must contain at least one number', 400);
    }
};

// ============================================================
// POST /api/auth/register
// ============================================================
const register = async (req, res, next) => {
    try {
        const { email, password, accountType } = req.body;

        if (!email || !password || !accountType) {
            throw new AppError('Email, password, and account type are required', 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new AppError('Invalid email address', 400);
        }

        // Validate password strength
        validatePassword(password);

        // Valid account types
        const validTypes = ['TRAVELER', 'TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];
        if (!validTypes.includes(accountType)) {
            throw new AppError('Invalid account type', 400);
        }

        // Check for duplicate email
        const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) {
            throw new AppError('An account with this email already exists', 409);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Email verification token
        const emailVerifyToken = uuidv4();

        // Create user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                hashedPassword,
                accountType,
                emailVerifyToken,
            },
        });

        // TODO: send verification email — Phase 2 email service
        // await emailService.sendVerification(user.email, emailVerifyToken);

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        await storeRefreshToken(user.id, refreshToken);

        res.status(201).json({
            success: true,
            message: 'Account created successfully. Please verify your email.',
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                accountType: user.accountType,
                onboardingComplete: user.onboardingComplete,
                emailVerified: user.emailVerified,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/auth/login
// ============================================================
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        // Find user — use generic error to avoid leaking which field is wrong
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        const GENERIC_AUTH_ERROR = 'Invalid email or password';

        if (!user || !user.hashedPassword) {
            throw new AppError(GENERIC_AUTH_ERROR, 401);
        }

        if (user.isDeleted) {
            throw new AppError(GENERIC_AUTH_ERROR, 401);
        }

        if (user.isSuspended) {
            throw new AppError('This account has been suspended. Contact support for assistance.', 403);
        }

        const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
        if (!passwordMatch) {
            throw new AppError(GENERIC_AUTH_ERROR, 401);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        await storeRefreshToken(user.id, refreshToken);

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                accountType: user.accountType,
                onboardingComplete: user.onboardingComplete,
                emailVerified: user.emailVerified,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/auth/logout
// ============================================================
const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await prisma.session.updateMany({
                where: { refreshToken },
                data: { isRevoked: true },
            });
        }

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/auth/refresh
// ============================================================
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new AppError('Refresh token required', 400);
        }

        const session = await prisma.session.findFirst({
            where: {
                refreshToken,
                isRevoked: false,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });

        if (!session) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        if (session.user.isSuspended || session.user.isDeleted) {
            throw new AppError('Account access denied', 403);
        }

        // Rotate refresh token
        await prisma.session.update({
            where: { id: session.id },
            data: { isRevoked: true },
        });

        const newRefreshToken = generateRefreshToken();
        await storeRefreshToken(session.userId, newRefreshToken);
        const accessToken = generateAccessToken(session.user);

        res.json({
            success: true,
            accessToken,
            refreshToken: newRefreshToken,
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw new AppError('Email is required', 400);
        }

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

        // Always return success — don't reveal if email exists
        if (user && !user.isDeleted) {
            const resetToken = uuidv4();
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 1); // 1 hour expiry

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordResetToken: resetToken,
                    passwordResetExpiry: expiry,
                },
            });

            // TODO: send reset email — Phase email service
            // await emailService.sendPasswordReset(user.email, resetToken);
        }

        res.json({
            success: true,
            message: 'If an account exists with this email, a reset link has been sent.',
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /api/auth/reset-password
// ============================================================
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            throw new AppError('Token and new password are required', 400);
        }

        validatePassword(password);

        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpiry: { gt: new Date() },
                isDeleted: false,
            },
        });

        if (!user) {
            throw new AppError('Invalid or expired reset token', 400);
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                hashedPassword,
                passwordResetToken: null,
                passwordResetExpiry: null,
            },
        });

        // Revoke all sessions
        await prisma.session.updateMany({
            where: { userId: user.id },
            data: { isRevoked: true },
        });

        res.json({ success: true, message: 'Password reset successfully. Please log in.' });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /api/auth/verify-email/:token
// ============================================================
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.params;

        const user = await prisma.user.findFirst({
            where: { emailVerifyToken: token, isDeleted: false },
        });

        if (!user) {
            throw new AppError('Invalid verification token', 400);
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, emailVerifyToken: null },
        });

        res.json({ success: true, message: 'Email verified successfully.' });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /api/auth/me
// ============================================================
const me = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                profile: {
                    include: { businessProfile: true },
                },
            },
        });

        if (!user || user.isDeleted) {
            throw new AppError('User not found', 404);
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                accountType: user.accountType,
                onboardingComplete: user.onboardingComplete,
                emailVerified: user.emailVerified,
                isSuspended: user.isSuspended,
                profile: user.profile,
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { register, login, logout, refresh, forgotPassword, resetPassword, verifyEmail, me };
