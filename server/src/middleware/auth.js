const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

/**
 * JWT authentication middleware.
 * Protects routes by requiring a valid JWT in the Authorization header.
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Authentication required', 401);
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            throw new AppError('Authentication required', 401);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Real-time suspension check
        const user = await require('../utils/prisma').user.findUnique({
            where: { id: decoded.id },
            select: { isSuspended: true }
        });

        if (!user || user.isSuspended) {
            throw new AppError('Account is suspended or does not exist', 403);
        }

        req.user = { ...decoded, isSuspended: user.isSuspended };
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token', 401));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token expired', 401));
        }
        next(error);
    }
};

/**
 * Role-based authorization middleware.
 * Must be used after authenticate middleware.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }
        if (!roles.includes(req.user.accountType) && !roles.includes('admin')) {
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
 * Optional auth — attaches user if valid JWT present, otherwise continues.
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = decoded;
            }
        }
    } catch {
        // Silently ignore invalid tokens for optional auth
    }
    next();
};

module.exports = { authenticate, authorize, adminOnly, optionalAuth };
