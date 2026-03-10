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

        // 1. Try Session Validation (Opaque Token / Server-side)
        const prisma = require('../utils/prisma');
        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: { select: { id: true, isSuspended: true, isDeleted: true, accountType: true, email: true } } }
        });

        if (session) {
            if (session.isRevoked || session.expiresAt < new Date()) {
                throw new AppError('Session expired or invalid', 401);
            }

            const user = session.user;
            if (!user || user.isSuspended || user.isDeleted) {
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
                accountType: user.accountType,
                isSuspended: user.isSuspended,
                sessionId: session.id
            };
            return next();
        }

        // 2. Fallback to JWT (Legacy or direct stateless API usage)
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, isSuspended: true, isDeleted: true, accountType: true, email: true }
            });

            if (!user || user.isSuspended || user.isDeleted) {
                throw new AppError('Account access denied', 403);
            }

            req.user = {
                id: user.id,
                email: user.email,
                accountType: user.accountType
            };
            next();
        } catch (jwtErr) {
            throw new AppError('Session expired or invalid token', 401);
        }
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
            const prisma = require('../utils/prisma');
            // Try session first
            const session = await prisma.session.findUnique({
                where: { token },
                select: { userId: true, user: { select: { accountType: true, email: true } } }
            });

            if (session) {
                req.user = {
                    id: session.userId,
                    email: session.user.email,
                    accountType: session.user.accountType
                };
            } else {
                // Try JWT fallback
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    req.user = {
                        id: decoded.id,
                        email: decoded.email,
                        accountType: decoded.accountType
                    };
                } catch { }
            }
        }
    } catch { }
    next();
};

module.exports = { authenticate, authorize, adminOnly, optionalAuth };
