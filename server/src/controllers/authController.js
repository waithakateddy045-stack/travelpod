const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 12;

const buildDicebearAvatar = (seed) =>
    `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;

const sanitizeEmail = (email) => String(email || '').trim().toLowerCase();

const validatePassword = (password) => {
    if (!password || password.length < 8) throw new AppError('Password must be at least 8 characters', 400);
};

const generateAccessToken = (user, sessionId) => {
    return jwt.sign(
        { id: user.id, email: user.email, accountType: user.accountType, sid: sessionId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );
};

const generateRefreshToken = (user, sessionId) => {
    return jwt.sign(
        { id: user.id, sid: sessionId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d' }
    );
};

const getDeviceType = (req) => (req.headers['x-device-type']?.toUpperCase() === 'ANDROID' ? 'ANDROID' : 'WEB');

// POST /api/auth/register
const register = async (req, res, next) => {
    try {
        const email = sanitizeEmail(req.body.email);
        const password = req.body.password;
        const requestedAccountType = req.body.accountType;

        if (!email || !password) throw new AppError('Email and password are required', 400);
        validatePassword(password);

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) throw new AppError('An account with this email already exists', 409);

        const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'traveler';
        const usernameBase = emailPrefix.toLowerCase();
        let username = usernameBase;
        for (let i = 0; i < 5; i++) {
            // eslint-disable-next-line no-await-in-loop
            const taken = await prisma.user.findUnique({ where: { username } });
            if (!taken) break;
            username = `${usernameBase}${Math.floor(Math.random() * 9000 + 1000)}`;
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Only allow known account types; default to TRAVELER for safety
        const allowedTypes = ['TRAVELER', 'TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];
        const accountType = allowedTypes.includes(requestedAccountType) ? requestedAccountType : 'TRAVELER';
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const user = await prisma.user.create({
            data: {
                email,
                password: passwordHash,
                username,
                displayName: null,
                avatarUrl: buildDicebearAvatar(username),
                accountType,
                onboardingComplete: false,
                otpCode,
                otpExpiresAt,
                otpVerified: false,
            },
            select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, accountType: true, onboardingComplete: true, isVerified: true, isAdmin: true },
        });

        const { sendOTP } = require('../utils/emailService');
        await sendOTP(email, otpCode);

        // Auto-follow Official Account
        const OFFICIAL_ID = 'cmmkq6gr100019q44pmqevmo6';
        if (user.id !== OFFICIAL_ID) {
            await prisma.follow.create({
                data: { followerId: user.id, followingId: OFFICIAL_ID }
            }).catch(() => { });
        }

        res.status(201).json({ success: true, message: 'OTP sent', email });
    } catch (err) {
        next(err);
    }
};

// POST /api/auth/verify-otp
const verifyOtp = async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) throw new AppError('Email and code are required', 400);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new AppError('User not found', 404);

        if (user.otpVerified) throw new AppError('Email already verified', 400);

        if (user.otpCode !== code) throw new AppError('Invalid OTP code', 400);
        if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) throw new AppError('OTP code has expired', 400);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otpVerified: true,
                otpCode: null,
                otpExpiresAt: null
            }
        });

        const deviceType = getDeviceType(req);
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                token: `PENDING-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                deviceType,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastActiveAt: new Date(),
            },
            select: { id: true },
        });

        const accessToken = generateAccessToken(user, session.id);
        const refreshToken = generateRefreshToken(user, session.id);
        await prisma.session.update({ where: { id: session.id }, data: { token: accessToken } });

        if (deviceType === 'WEB') {
            res.cookie('travelpod_session', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
            });
        }

        const userObj = { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, accountType: user.accountType, onboardingComplete: user.onboardingComplete, isVerified: user.isVerified, isAdmin: user.isAdmin };
        res.status(200).json({ success: true, accessToken, refreshToken, user: userObj });
    } catch (err) {
        next(err);
    }
};

// POST /api/auth/resend-otp
const resendOtp = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) throw new AppError('Email is required', 400);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new AppError('User not found', 404);
        if (user.otpVerified) throw new AppError('Email already verified', 400);

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode, otpExpiresAt }
        });

        const { sendOTP } = require('../utils/emailService');
        await sendOTP(email, otpCode);

        res.status(200).json({ success: true, message: 'OTP resent' });
    } catch (err) {
        next(err);
    }
};

// POST /api/auth/login
const login = async (req, res, next) => {
    try {
        const email = sanitizeEmail(req.body.email);
        const password = req.body.password;
        if (!email || !password) throw new AppError('Email and password are required', 400);

        const user = await prisma.user.findUnique({ where: { email } });
        const GENERIC = 'Invalid email or password';
        if (!user || !user.password) throw new AppError(GENERIC, 401);
        if (user.isSuspended) throw new AppError('This account has been suspended', 403);

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) throw new AppError(GENERIC, 401);

        const deviceType = getDeviceType(req);
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                token: `PENDING-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                deviceType,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastActiveAt: new Date(),
            },
            select: { id: true },
        });

        const isSpecialAdmin = [
            'admin@travelpod.com',
            'official@travelpod.com',
            'waithakateddy045@gmail.com'
        ].includes(email);

        if (isSpecialAdmin) {
            // High privilege flow: issue a temporary MFA session
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordResetToken: `ADMIN-OTP-${otp}`,
                    passwordResetExpiresAt: expires
                }
            });

            // Log the OTP for development/user visibility since we don't have mailer
            console.log(`[SECURITY] High privilege login for ${email}. OTP: ${otp} (sent to waithakateddy045@gmail.com)`);

            return res.json({
                success: true,
                requiresMfa: true,
                mfaType: 'EMAIL_OTP',
                targetEmail: 'waithakateddy045@gmail.com',
                tempToken: jwt.sign({ id: user.id, purpose: 'ADMIN_MFA' }, process.env.JWT_SECRET, { expiresIn: '10m' })
            });
        }

        const accessToken = generateAccessToken(user, session.id);
        const refreshToken = generateRefreshToken(user, session.id);
        await prisma.session.update({ where: { id: session.id }, data: { token: accessToken } });

        if (deviceType === 'WEB') {
            res.cookie('travelpod_session', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
            });
        }

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                accountType: user.accountType,
                onboardingComplete: user.onboardingComplete,
                isVerified: user.isVerified,
                isAdmin: user.isAdmin,
            },
        });
    } catch (err) {
        next(err);
    }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : req.cookies?.travelpod_session;

        if (token) {
            await prisma.session.deleteMany({ where: { token } });
            res.clearCookie('travelpod_session');
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) throw new AppError('Refresh token required', 400);

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        const session = await prisma.session.findUnique({
            where: { id: decoded.sid },
            include: { user: true },
        });
        if (!session || session.userId !== decoded.id) throw new AppError('Invalid session', 401);
        if (session.expiresAt < new Date()) throw new AppError('Session expired', 401);
        if (session.user.isSuspended) throw new AppError('Account access denied', 403);

        const accessToken = generateAccessToken(session.user, session.id);
        await prisma.session.update({
            where: { id: session.id },
            data: { token: accessToken, lastActiveAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        });

        res.json({ success: true, accessToken });
    } catch (err) {
        next(err);
    }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
    try {
        const email = sanitizeEmail(req.body.email);
        if (!email) throw new AppError('Email is required', 400);

        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            const token = jwt.sign({ id: user.id, email }, process.env.JWT_REFRESH_SECRET, { expiresIn: '1h' });
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordResetToken: token, passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
            });
            // Email delivery is intentionally omitted here; integrate Resend in production.
        }

        res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
    } catch (err) {
        next(err);
    }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) throw new AppError('Token and new password are required', 400);
        validatePassword(password);

        const user = await prisma.user.findFirst({
            where: { passwordResetToken: token, passwordResetExpiresAt: { gt: new Date() } },
        });
        if (!user) throw new AppError('Invalid or expired reset token', 400);

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hash, passwordResetToken: null, passwordResetExpiresAt: null },
        });

        await prisma.session.deleteMany({ where: { userId: user.id } });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

// GET /api/auth/verify-email/:token (not used in PRD v3.0)
const verifyEmail = async (_req, res) => {
    res.json({ success: true });
};

// GET /api/auth/me
const me = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                websiteUrl: true,
                accountType: true,
                isVerified: true,
                isAdmin: true,
                isSuspended: true,
                onboardingComplete: true,
                personalityTags: true,
                preferredRegions: true,
                followerCount: true,
                followingCount: true,
                totalLikes: true,
                parentAccountId: true,
                isManagedBusinessPage: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) throw new AppError('User not found', 404);
        res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /api/auth/sessions
// ============================================================
const getSessions = async (req, res, next) => {
    try {
        const sessions = await prisma.session.findMany({
            where: {
                userId: req.user.id,
                expiresAt: { gt: new Date() }
            },
            select: {
                id: true,
                deviceType: true,
                lastActiveAt: true,
                createdAt: true
            },
            orderBy: { lastActiveAt: 'desc' }
        });

        res.json({ success: true, sessions });
    } catch (err) { next(err); }
};

// ============================================================
// DELETE /api/auth/sessions/:id
// ============================================================
const deleteSession = async (req, res, next) => {
    try {
        const { id } = req.params;
        const session = await prisma.session.findUnique({ where: { id } });

        if (!session || session.userId !== req.user.id) {
            throw new AppError('Session not found', 404);
        }

        await prisma.session.delete({ where: { id } });

        res.json({ success: true, message: 'Session terminated' });
    } catch (err) { next(err); }
};

// POST /api/auth/confirm-admin-otp
const confirmAdminOtp = async (req, res, next) => {
    try {
        const { tempToken, otp } = req.body;
        if (!tempToken || !otp) throw new AppError('Token and OTP required', 400);

        const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (decoded.purpose !== 'ADMIN_MFA') throw new AppError('Invalid token purpose', 401);

        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user || user.passwordResetToken !== `ADMIN-OTP-${otp}`) {
            throw new AppError('Invalid or expired OTP', 401);
        }

        if (user.passwordResetExpiresAt < new Date()) {
            throw new AppError('OTP expired', 401);
        }

        // Clear OTP
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordResetToken: null, passwordResetExpiresAt: null }
        });

        const deviceType = getDeviceType(req);
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                token: `PENDING-ADMIN-${Date.now()}`,
                deviceType,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastActiveAt: new Date(),
            },
            select: { id: true },
        });

        const accessToken = generateAccessToken(user, session.id);
        const refreshToken = generateRefreshToken(user, session.id);
        await prisma.session.update({ where: { id: session.id }, data: { token: accessToken } });

        if (deviceType === 'WEB') {
            res.cookie('travelpod_session', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
            });
        }

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                accountType: user.accountType,
                onboardingComplete: user.onboardingComplete,
                isVerified: user.isVerified,
                isAdmin: user.isAdmin,
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    register,
    login,
    logout,
    refresh,
    forgotPassword,
    resetPassword,
    verifyEmail,
    me,
    getSessions,
    deleteSession,
    confirmAdminOtp
};
