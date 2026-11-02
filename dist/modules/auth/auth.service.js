"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const index_js_1 = require("../../config/index.js");
const db_js_1 = require("../../services/db.js");
const sms_js_1 = require("../../services/sms.js");
const errors_js_1 = require("../../common/errors.js");
const shared_1 = require("@gatigo/shared");
class AuthService {
    async sendOtp(phone, role) {
        if (!phone || phone.length < 10) {
            throw new errors_js_1.BadRequestError('Invalid phone number format');
        }
        const { sessionToken, expiresInSeconds, devOtp } = sms_js_1.smsService.generateOtp(phone);
        return {
            sessionToken,
            expiresInSeconds,
            ...(index_js_1.config.env !== 'production' ? { devOtp } : {})
        };
    }
    async verifyOtp(phone, otp, sessionToken, requestedRole = shared_1.UserRole.CUSTOMER, name) {
        const isValid = sms_js_1.smsService.verifyOtp(phone, otp, sessionToken);
        if (!isValid) {
            throw new errors_js_1.BadRequestError('Invalid or expired OTP');
        }
        let user = await db_js_1.db.users.findByPhone(phone);
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await db_js_1.db.users.create({
                phone,
                name: name || (requestedRole === shared_1.UserRole.DRIVER ? 'Partner Driver' : 'GatiGo Customer'),
                preferredLanguage: 'en',
                role: requestedRole,
                isActive: true,
                isVerified: true
            });
        }
        // Ensure wallet exists
        db_js_1.db.wallets.findByUserId(user.id);
        let customerProfileId;
        let driverProfileId;
        let kycStatus;
        if (user.role === shared_1.UserRole.CUSTOMER || requestedRole === shared_1.UserRole.CUSTOMER) {
            let customer = await db_js_1.db.customerProfiles.findByUserId(user.id);
            if (!customer) {
                customer = await db_js_1.db.customerProfiles.create({
                    userId: user.id,
                    ratingAverage: 5.0,
                    totalTrips: 0
                });
            }
            customerProfileId = customer.id;
        }
        if (user.role === shared_1.UserRole.DRIVER || requestedRole === shared_1.UserRole.DRIVER) {
            let driver = await db_js_1.db.driverProfiles.findByUserId(user.id);
            if (!driver) {
                driver = await db_js_1.db.driverProfiles.create({
                    userId: user.id,
                    licenseNumber: 'PENDING_UPLOAD',
                    experienceYears: 1,
                    kycStatus: shared_1.KycStatus.PENDING,
                    serviceCity: 'Ranchi',
                    operatingState: 'Jharkhand',
                    ratingAverage: 5.0,
                    totalCompletedTrips: 0,
                    totalSharedCreated: 0,
                    totalSharedFulfilled: 0
                });
            }
            driverProfileId = driver.id;
            kycStatus = driver.kycStatus;
        }
        const tokens = this.generateTokenPair({
            userId: user.id,
            phone: user.phone,
            role: user.role,
            customerId: customerProfileId,
            driverId: driverProfileId,
            kycStatus
        });
        return {
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                isNewUser,
                customerId: customerProfileId,
                driverId: driverProfileId,
                kycStatus
            },
            ...tokens
        };
    }
    async adminLogin(email, password) {
        const user = await db_js_1.db.users.findByEmail(email);
        if (!user) {
            throw new errors_js_1.UnauthorizedError('Invalid admin email or password');
        }
        const admin = await db_js_1.db.adminUsers.findByUserId(user.id);
        if (!admin) {
            throw new errors_js_1.UnauthorizedError('Administrative credentials not found for this account');
        }
        const isMatch = await bcrypt_1.default.compare(password, admin.passwordHash);
        if (!isMatch) {
            throw new errors_js_1.UnauthorizedError('Invalid admin email or password');
        }
        const tokens = this.generateTokenPair({
            userId: user.id,
            phone: user.phone,
            role: user.role,
            adminId: admin.id
        });
        return {
            admin: {
                id: admin.id,
                userId: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: admin.department
            },
            ...tokens
        };
    }
    async refreshToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, index_js_1.config.jwt.refreshSecret);
            const user = await db_js_1.db.users.findById(decoded.sub);
            if (!user || !user.isActive) {
                throw new errors_js_1.UnauthorizedError('User session is no longer active');
            }
            const customer = await db_js_1.db.customerProfiles.findByUserId(user.id);
            const driver = await db_js_1.db.driverProfiles.findByUserId(user.id);
            const admin = await db_js_1.db.adminUsers.findByUserId(user.id);
            return this.generateTokenPair({
                userId: user.id,
                phone: user.phone,
                role: user.role,
                customerId: customer?.id,
                driverId: driver?.id,
                adminId: admin?.id,
                kycStatus: driver?.kycStatus
            });
        }
        catch (err) {
            throw new errors_js_1.UnauthorizedError('Invalid or expired refresh token');
        }
    }
    generateTokenPair(claims) {
        const accessToken = jsonwebtoken_1.default.sign({
            sub: claims.userId,
            phone: claims.phone,
            role: claims.role,
            customerId: claims.customerId,
            driverId: claims.driverId,
            adminId: claims.adminId,
            kycStatus: claims.kycStatus
        }, index_js_1.config.jwt.secret, { expiresIn: index_js_1.config.jwt.expiresIn });
        const refreshToken = jsonwebtoken_1.default.sign({
            sub: claims.userId,
            role: claims.role
        }, index_js_1.config.jwt.refreshSecret, { expiresIn: index_js_1.config.jwt.refreshExpiresIn });
        return { accessToken, refreshToken, expiresIn: index_js_1.config.jwt.expiresIn };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
