import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      error: err.errorCode,
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString()
    });
  }

  logger.error('Unhandled internal server error:', err);

  return res.status(500).json({
    success: false,
    statusCode: 500,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : err.message,
    timestamp: new Date().toISOString()
  });
}
