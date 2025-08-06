import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
    statusCode?: number;
    status?: number;
}

export const errorHandler = (
    err: CustomError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let error = { ...err };
    error.message = err.message;

    // Log error for debugging
    console.error(err);

    // Default to 500 server error
    let statusCode = error.statusCode || error.status || 500;
    let message = error.message || 'Internal Server Error';

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    }

    // Mongoose duplicate key
    if (err.name === 'MongoError' && (err as any).code === 11000) {
        statusCode = 400;
        message = 'Duplicate field value entered';
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values((err as any).errors)
            .map((val: any) => val.message)
            .join(', ');
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
