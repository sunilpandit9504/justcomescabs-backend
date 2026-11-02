"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: (message, meta) => {
        console.log(`[INFO]  ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
    },
    warn: (message, meta) => {
        console.warn(`[WARN]  ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
    },
    error: (message, error) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    },
    debug: (message, meta) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
        }
    }
};
