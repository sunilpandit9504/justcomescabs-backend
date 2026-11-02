"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://gatigo_admin:gatigo_secure_password_2026@localhost:5432/gatigo_mobility_db?schema=public',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwt: {
        secret: process.env.JWT_SECRET || 'gatigo_super_secret_jwt_key_jharkhand_bihar_2026',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'gatigo_super_secret_refresh_key_2026',
        refreshExpiresIn: '30d'
    },
    cors: {
        origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',')
    },
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        keySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder'
    },
    googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSy_placeholder_key'
    }
};
