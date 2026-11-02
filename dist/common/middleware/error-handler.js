"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_js_1 = require("../errors.js");
const logger_js_1 = require("../logger.js");
function errorHandler(err, req, res, next) {
    if (err instanceof errors_js_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            statusCode: err.statusCode,
            error: err.errorCode,
            message: err.message,
            details: err.details,
            timestamp: new Date().toISOString()
        });
    }
    logger_js_1.logger.error('Unhandled internal server error:', err);
    return res.status(500).json({
        success: false,
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : err.message,
        timestamp: new Date().toISOString()
    });
}
