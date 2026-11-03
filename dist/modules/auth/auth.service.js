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
const logger_js_1 = require("../../common/logger.js");
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
    async registerDriver(data) {
        if (!data.phone || !data.name) {
            throw new errors_js_1.BadRequestError('Driver name and phone number are required');
        }
        const cleanPhone = data.phone.trim();
        let user = await db_js_1.db.users.findByPhone(cleanPhone);
        if (!user) {
            user = await db_js_1.db.users.create({
                phone: cleanPhone,
                name: data.name.trim(),
                role: shared_1.UserRole.DRIVER,
                isActive: true,
                isVerified: false,
                preferredLanguage: 'hi'
            });
        }
        else {
            user = await db_js_1.db.users.update(user.id, {
                name: data.name.trim(),
                role: shared_1.UserRole.DRIVER
            }) || user;
        }
        let driver = await db_js_1.db.driverProfiles.findByUserId(user.id);
        if (!driver) {
            driver = await db_js_1.db.driverProfiles.create({
                userId: user.id,
                licenseNumber: data.dlNumber || 'PENDING',
                experienceYears: 3,
                kycStatus: shared_1.KycStatus.UNDER_REVIEW,
                serviceCity: data.city || 'Godda',
                operatingState: 'Jharkhand',
                ratingAverage: 5.0,
                totalCompletedTrips: 0,
                totalSharedCreated: 0,
                totalSharedFulfilled: 0
            });
        }
        else {
            driver = await db_js_1.db.driverProfiles.update(driver.id, {
                licenseNumber: data.dlNumber || driver.licenseNumber,
                serviceCity: data.city || driver.serviceCity,
                kycStatus: shared_1.KycStatus.UNDER_REVIEW,
                kycRejectionReason: undefined
            }) || driver;
        }
        // Vehicle setup
        const vehicles = await db_js_1.db.vehicles.findByDriverId(driver.id);
        const category = data.vehicleCategory?.toUpperCase() || shared_1.VehicleCategory.SEDAN;
        const plate = data.vehiclePlate?.trim() || `JH-${Date.now().toString().slice(-4)}`;
        if (vehicles.length === 0) {
            await db_js_1.db.vehicles.create({
                driverId: driver.id,
                category,
                registrationNumber: plate,
                make: data.vehicleMake?.trim() || 'Maruti Suzuki',
                model: data.vehicleModel?.trim() || 'Dzire Tour',
                color: 'White',
                year: new Date().getFullYear(),
                seatingCapacity: category === shared_1.VehicleCategory.AUTO ? 3 : category === shared_1.VehicleCategory.SUV ? 6 : 4,
                isAc: true,
                rcNumber: data.rcNumber?.trim() || plate,
                isVerified: false,
                isActive: true
            });
        }
        else {
            await db_js_1.db.vehicles.update(vehicles[0].id, {
                category,
                registrationNumber: plate,
                make: data.vehicleMake?.trim() || vehicles[0].make,
                model: data.vehicleModel?.trim() || vehicles[0].model,
                rcNumber: data.rcNumber?.trim() || vehicles[0].rcNumber,
                isVerified: false
            });
        }
        // Documents setup
        const docs = data.uploadedDocs || {};
        const defaultDlImg = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600';
        const defaultRcImg = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600';
        const defaultInsImg = 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600';
        const defaultSelfieImg = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600';
        const documentSpecs = [
            { type: 'DRIVING_LICENSE_FRONT', number: data.dlNumber, url: typeof docs.dl === 'string' && docs.dl.startsWith('http') ? docs.dl : defaultDlImg },
            { type: 'VEHICLE_RC', number: data.rcNumber, url: typeof docs.rc === 'string' && docs.rc.startsWith('http') ? docs.rc : defaultRcImg },
            { type: 'VEHICLE_INSURANCE', number: data.insuranceNumber, url: typeof docs.insurance === 'string' && docs.insurance.startsWith('http') ? docs.insurance : defaultInsImg },
            { type: 'DRIVER_PHOTO_SELFIE', number: undefined, url: typeof docs.selfie === 'string' && docs.selfie.startsWith('http') ? docs.selfie : defaultSelfieImg }
        ];
        const existingDocs = await db_js_1.db.driverDocuments.findByDriverId(driver.id);
        for (const spec of documentSpecs) {
            const match = existingDocs.find(d => d.documentType === spec.type);
            if (!match) {
                await db_js_1.db.driverDocuments.create({
                    driverId: driver.id,
                    documentType: spec.type,
                    fileUrl: spec.url,
                    documentNumber: spec.number,
                    verificationStatus: 'PENDING'
                });
            }
            else {
                match.documentNumber = spec.number || match.documentNumber;
                match.fileUrl = spec.url || match.fileUrl;
                match.verificationStatus = 'PENDING';
                match.reviewedAt = undefined;
            }
        }
        // Availability
        await db_js_1.db.driverAvailability.upsert(driver.id, {
            isOnline: false,
            currentLatitude: 24.8267,
            currentLongitude: 87.2156
        });
        // Wallet
        let wallet = await db_js_1.db.wallets.findByUserId(user.id);
        if (!wallet) {
            wallet = await db_js_1.db.wallets.create({
                userId: user.id,
                currency: 'INR',
                balance: 650.0,
                lockedBalance: 0,
                isFrozen: false
            });
        }
        const tokens = this.generateTokenPair({
            userId: user.id,
            phone: user.phone,
            role: user.role,
            driverId: driver.id,
            kycStatus: shared_1.KycStatus.UNDER_REVIEW
        });
        logger_js_1.logger.info(`New Driver registered successfully: ${user.name} (${user.phone}) - KYC status: UNDER_REVIEW`);
        return {
            driver: {
                id: driver.id,
                userId: user.id,
                name: user.name,
                phone: user.phone,
                serviceCity: driver.serviceCity,
                kycStatus: driver.kycStatus
            },
            ...tokens
        };
    }
    async adminLogin(email, password) {
        const cleanEmail = email.trim().toLowerCase();
        const cleanPass = password.trim();
        // Direct master admin login for Justcomes Cab
        if ((cleanEmail === 'admin@justcomes.in' || cleanEmail === 'admin@gatigo.in') &&
            (cleanPass === 'Priyansh@9504' || cleanPass === 'AdminPassword@2026')) {
            let user = await db_js_1.db.users.findByEmail(cleanEmail);
            if (!user) {
                user = await db_js_1.db.users.create({
                    phone: '+919504329735',
                    email: cleanEmail,
                    name: 'Justcomes Chief Admin',
                    preferredLanguage: 'hi',
                    role: shared_1.UserRole.SUPER_ADMIN,
                    isActive: true,
                    isVerified: true
                });
            }
            let admin = await db_js_1.db.adminUsers.findByUserId(user.id);
            if (!admin) {
                admin = await db_js_1.db.adminUsers.create({
                    userId: user.id,
                    department: 'CENTRAL_OPERATIONS',
                    passwordHash: await bcrypt_1.default.hash(cleanPass, 10)
                });
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
        const user = await db_js_1.db.users.findByEmail(cleanEmail);
        if (!user) {
            throw new errors_js_1.UnauthorizedError('Invalid admin email or password');
        }
        const admin = await db_js_1.db.adminUsers.findByUserId(user.id);
        if (!admin) {
            throw new errors_js_1.UnauthorizedError('Administrative credentials not found for this account');
        }
        const isMatch = await bcrypt_1.default.compare(cleanPass, admin.passwordHash);
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
