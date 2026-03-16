const errorHandler = (err, req, res, next) => {
    // Log relevant error details
    console.error(`[${new Date().toISOString()}] Error ${err.statusCode || 500}: ${err.message}`);

    if (err.code) {
        console.error('Prisma/DB Error Code:', err.code);
    }

    if (process.env.NODE_ENV === 'development') {
        console.error('Stack:', err.stack);
    }

    const statusCode = err.statusCode || 500;
    // For now, including the message to debug railway issues
    const message = err.isOperational ? err.message : (err.message || 'Internal Server Error');

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { errorHandler, AppError };
