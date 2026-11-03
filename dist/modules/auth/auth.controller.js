"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_js_1 = require("./auth.service.js");
const db_js_1 = require("../../services/db.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
class AuthController {
    async sendOtp(req, res, next) {
        try {
            const { phone, role = shared_1.UserRole.CUSTOMER } = req.body;
            if (!phone) {
                throw new errors_js_1.BadRequestError('Phone number is required');
            }
            const result = await auth_service_js_1.authService.sendOtp(phone, role);
            res.status(200).json({
                success: true,
                statusCode: 200,
                message: 'OTP sent successfully',
                data: result,
                timestamp: new Date().toISOString()
            });
        }
        catch (err) {
            next(err);
        }
    }
    async verifyOtp(req, res, next) {
        try {
            const { phone, otp, sessionToken, role, name } = req.body;
            if (!phone || !otp) {
                throw new errors_js_1.BadRequestError('Phone and OTP are required');
            }
            const result = await auth_service_js_1.authService.verifyOtp(phone, otp, sessionToken, role, name);
            res.status(200).json({
                success: true,
                statusCode: 200,
                message: 'Authentication successful',
                data: result,
                timestamp: new Date().toISOString()
            });
        }
        catch (err) {
            next(err);
        }
    }
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                throw new errors_js_1.BadRequestError('Refresh token is required');
            }
            const result = await auth_service_js_1.authService.refreshToken(refreshToken);
            res.status(200).json({
                success: true,
                statusCode: 200,
                message: 'Tokens refreshed successfully',
                data: result,
                timestamp: new Date().toISOString()
            });
        }
        catch (err) {
            next(err);
        }
    }
    async adminLogin(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                throw new errors_js_1.BadRequestError('Email and password are required');
            }
            const result = await auth_service_js_1.authService.adminLogin(email, password);
            res.status(200).json({
                success: true,
                statusCode: 200,
                message: 'Admin authentication successful',
                data: result,
                timestamp: new Date().toISOString()
            });
        }
        catch (err) {
            next(err);
        }
    }
    async getMe(req, res, next) {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            const user = await db_js_1.db.users.findById(req.user.id);
            const customer = req.user.customerId ? await db_js_1.db.customerProfiles.findById(req.user.customerId) : null;
            const driver = req.user.driverId ? await db_js_1.db.driverProfiles.findById(req.user.driverId) : null;
            const wallet = await db_js_1.db.wallets.findByUserId(req.user.id);
            res.status(200).json({
                success: true,
                statusCode: 200,
                data: {
                    user,
                    customerProfile: customer,
                    driverProfile: driver,
                    wallet
                },
                timestamp: new Date().toISOString()
            });
        }
        catch (err) {
            next(err);
        }
    }
    async registerDriver(req, res, next) {
        try {
            const result = await auth_service_js_1.authService.registerDriver(req.body);
            res.status(200).json({
                success: true,
                statusCode: 200,
                message: 'Driver registration and KYC submitted successfully! Under review by Admin.',
                data: result,
                timestamp: new Date().toISOString()
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
