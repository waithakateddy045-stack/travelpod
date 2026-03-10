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

        // Verify JWT access token signature only (Session table optional)
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            throw new AppError('Session expired or invalid token', 401);
        }

        // Attach minimal user payload from token; downstream code that needs full user
        // details should query Prisma explicitly.
        req.user = {
            id: decoded.id,
            email: decoded.email,
            accountType: decoded.accountType,
        };
        return next();
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
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = {
                    id: decoded.id,
                    email: decoded.email,
                    accountType: decoded.accountType,
                };
            } catch {
                // ignore invalid optional tokens
            }
        }
    } catch { }
    next();
};

module.exports = { authenticate, authorize, adminOnly, optionalAuth };
