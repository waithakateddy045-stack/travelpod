const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

/**
 * JWT authentication middleware.
 * Protects routes by requiring a valid JWT in the Authorization header.
 */
/**
 * JWT authentication middleware with Session validation.
 * Protects routes by requiring a valid JWT and a valid DB session.
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies?.travelpod_session;
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (cookieToken) {
            token = cookieToken;
        }

        if (!token) {
            throw new AppError('Authentication required', 401);
        }

        // 1. Verify JWT access token signature
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            throw new AppError('Session expired or invalid token', 401);
        }

        // 2. Validate token against Session table (server-side)
        const prisma = require('../utils/prisma');
        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, accountType: true, isAdmin: true, isVerified: true, isSuspended: true, onboardingComplete: true } } }
        });

        if (session) {
            if (session.expiresAt < new Date() || session.userId !== decoded.id) {
                throw new AppError('Session expired or invalid', 401);
            }

            const user = session.user;
            if (!user || user.isSuspended) {
                throw new AppError('Account access denied', 403);
            }

            // Update lastActiveAt & Extend Session
            prisma.session.update({
                where: { id: session.id },
                data: { lastActiveAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
            }).catch(() => { });

            req.user = {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                accountType: user.accountType,
                isAdmin: user.isAdmin,
                isVerified: user.isVerified,
                isSuspended: user.isSuspended,
                onboardingComplete: user.onboardingComplete,
                sessionId: session.id
            };
            return next();
        }

        // JWT is valid but not present in Session table
        throw new AppError('Session expired or invalid', 401);
    } catch (error) {
        next(error);
    }
};

/**
 * Role-based authorization middleware.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }
        if (!roles.includes(req.user.accountType) && !roles.includes('admin') && req.user.accountType !== 'ADMIN') {
            return next(new AppError('Insufficient permissions', 403));
        }
        next();
    };
};

/**
 * Admin-only middleware.
 */
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.accountType !== 'ADMIN') {
        return next(new AppError('Admin access required', 403));
    }
    next();
};

/**
 * Optional auth — attaches user if valid Session or JWT present.
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies?.travelpod_session;
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (cookieToken) {
            token = cookieToken;
        }

            if (token) {
                let decoded;
                try {
                    decoded = jwt.verify(token, process.env.JWT_SECRET);
                } catch {
                    return next();
                }

                const prisma = require('../utils/prisma');
                const session = await prisma.session.findUnique({
                    where: { token },
                    select: { userId: true, expiresAt: true, user: { select: { email: true, username: true, displayName: true, avatarUrl: true, accountType: true, isAdmin: true, isVerified: true, isSuspended: true, onboardingComplete: true } } }
                });

                if (session && session.userId === decoded.id && session.expiresAt > new Date()) {
                    req.user = {
                        id: session.userId,
                        email: session.user.email,
                        username: session.user.username,
                        displayName: session.user.displayName,
                        avatarUrl: session.user.avatarUrl,
                        accountType: session.user.accountType,
                        isAdmin: session.user.isAdmin,
                        isVerified: session.user.isVerified,
                        isSuspended: session.user.isSuspended,
                        onboardingComplete: session.user.onboardingComplete
                    };
                }
            }
    } catch { }
    next();
};

module.exports = { authenticate, authorize, adminOnly, optionalAuth };
