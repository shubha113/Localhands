import {catchAsyncError} from './catchAsyncError.js'
import ErrorHandler from '../utils/errorHandler.js'
import { User } from '../models/User.js';
import { Provider } from '../models/Provider.js';
import jwt from 'jsonwebtoken'
import { cookie } from 'express-validator';

// Check if user is authenticated

// Check if user is authenticated
export const isAuthenticated = catchAsyncError(async (req, res, next) => {
    let token;

    // 1. Check for token in Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log('isAuthenticated: Token found in Authorization header.');
    } 
    // 2. Fallback: Check for token in cookies (if client sends it this way for other routes)
    else if (req.cookies.token) {
        token = req.cookies.token;
        console.log('isAuthenticated: Token found in cookies.');
    }

    if (!token) {
        console.log('isAuthenticated: No token found in headers or cookies. Returning 401.');
        return next(new ErrorHandler('Please login to access this resource', 401));
    }

    try {
        const decodedData = jwt.verify(token, process.env.JWT_SECRET);
        console.log('isAuthenticated: JWT decoded successfully:', decodedData.id);

        let user = await User.findById(decodedData.id);
        if (user) {
            req.user = user;
            req.userType = 'user';
            console.log('isAuthenticated: User found (Type: User).');
        } else {
            user = await Provider.findById(decodedData.id);
            if (user) {
                req.user = user;
                req.userType = 'provider';
                console.log('isAuthenticated: User found (Type: Provider).');
            }
        }

        if (!user) {
            console.log('isAuthenticated: User not found in DB after decoding token. Returning 404.');
            return next(new ErrorHandler('User not found', 404));
        }

        next(); // Proceed to the next middleware or controller
    } catch (error) {
        console.error('isAuthenticated: Token verification failed:', error.message);
        // Log specific JWT errors for better debugging
        if (error instanceof jwt.JsonWebTokenError) {
            console.error('isAuthenticated: JWT Error details:', error.name, error.message);
        }
        return next(new ErrorHandler('Invalid or expired token. Please login again.', 401));
    }
});

// Check user roles
export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new ErrorHandler(
                `Role (${req.user.role}) is not allowed to access this resource`, 403
            ));
        }
        next();
    };
};

// Check if user is verified
export const isVerified = (req, res, next) => {
    if (!req.user.isVerified) {
        return next(new ErrorHandler('Please verify your email first', 403));
    }
    next();
};

// Check if provider is approved
export const isApprovedProvider = (req, res, next) => {
    if (req.user.role === 'provider' && req.user.status !== 'verified') {
        return next(new ErrorHandler('Your provider account is not approved yet', 403));
    }
    next();
};
