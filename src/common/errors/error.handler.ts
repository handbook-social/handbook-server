import { NextFunction, Request, Response } from 'express';
import { CastError } from 'mongoose';
import { HTTP_STATUS } from '../constants/status-code';
import { ResponseUtil } from '../utils/response';
import { AppError } from './app.error';
import { env } from '../config';

/**
 * Handle Mongoose CastError
 */
const handleCastErrorDB = (err: CastError): AppError => {
    const message = `Invalid ${err.path}: ${err.value}.`;
    return new AppError(message, HTTP_STATUS.BAD_REQUEST);
};

/**
 * Handle Mongoose Duplicate Key Error
 */
const handleDuplicateFieldsDB = (err: any): AppError => {
    const value =
        err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || 'duplicate value';
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, HTTP_STATUS.CONFLICT);
};

/**
 * Handle Mongoose Validation Error
 */
const handleValidationErrorDB = (err: any): AppError => {
    const errors = Object.values(err.errors).map((el: any) => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, errors);
};

/**
 * Handle JWT Error
 */
const handleJWTError = (): AppError => {
    return new AppError(
        'Invalid token. Please log in again!',
        HTTP_STATUS.UNAUTHORIZED
    );
};

/**
 * Handle JWT Expired Error
 */
const handleJWTExpiredError = (): AppError => {
    return new AppError(
        'Your token has expired! Please log in again.',
        HTTP_STATUS.UNAUTHORIZED
    );
};

/**
 * Send error response in development mode
 */
const sendErrorDev = (err: AppError, res: Response): void => {
    ResponseUtil.error(res, err.message, err.statusCode, err.details);
};

/**
 * Send error response in production mode
 */
const sendErrorProd = (err: AppError, res: Response): void => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        ResponseUtil.error(res, err.message, err.statusCode, err.details);
    } else {
        // Programming or other unknown error: don't leak error details
        console.error('ERROR', err);

        ResponseUtil.error(
            res,
            'Something went very wrong!',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * Global Error Handler Middleware
 */
export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Set default values
    err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    err.status = err.status || 'error';

    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') {
        error = handleCastErrorDB(error);
    }

    if (error.code === 11000) {
        error = handleDuplicateFieldsDB(error);
    }

    if (error.name === 'ValidationError') {
        error = handleValidationErrorDB(error);
    }

    if (error.name === 'JsonWebTokenError') {
        error = handleJWTError();
    }

    if (error.name === 'TokenExpiredError') {
        error = handleJWTExpiredError();
    }

    // Log error details
    console.error('Error Details:', {
        message: err.message || error.message,
        statusCode: err.statusCode || error.statusCode,
        stack: err.stack,
        details: err.details || error.details,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
    });

    // Send appropriate error response based on environment
    if (env.NODE_ENV === 'development') {
        sendErrorDev(error, res);
    } else {
        sendErrorProd(error, res);
    }
};

/**
 * Not Found Handler Middleware
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    ResponseUtil.notFound(res, `Route ${req.originalUrl} not found`);
};

/**
 * Error Handler for Unhandled Promise Rejections
 */
export const handleUnhandledRejection = (): void => {
    process.on('unhandledRejection', (err: any) => {
        console.error('UNHANDLED REJECTION! Shutting down...');
        console.error(err);
        process.exit(1);
    });
};

/**
 * Error Handler for Uncaught Exceptions
 */
export const handleUncaughtException = (): void => {
    process.on('uncaughtException', (err: any) => {
        console.error('UNCAUGHT EXCEPTION! Shutting down...');
        console.error(err);
        process.exit(1);
    });
};
