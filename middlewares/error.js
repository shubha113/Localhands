const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = `Resource not found. Invalid: ${err.path}`;
        return res.status(400).json({
            success: false,
            message
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const message = `Duplicate field value entered`;
        return res.status(400).json({
            success: false,
            message
        });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        return res.status(400).json({
            success: false,
            message
        });
    }

    // JWT error
    if (err.name === 'JsonWebTokenError') {
        const message = 'JWT is invalid, try again';
        return res.status(401).json({
            success: false,
            message
        });
    }

    // JWT expired error
    if (err.name === 'TokenExpiredError') {
        const message = 'JWT is expired, try again';
        return res.status(401).json({
            success: false,
            message
        });
    }

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error"
    });
};

export default errorMiddleware;