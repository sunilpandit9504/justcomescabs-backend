"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
exports.normalizePhone = normalizePhone;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../../config/index.js");
const db_js_1 = require("../../services/db.js");
const sms_js_1 = require("../../services/sms.js");
const errors_js_1 = require("../../common/errors.js");
const shared_1 = require("@gatigo/shared");
const logger_js_1 = require("../../common/logger.js");
function saveDocumentImage(driverId, docType, input) {
    if (!input || typeof input !== 'string')
        return null;
    // If already an absolute http/https URL, keep it
    if (input.startsWith('http://') || input.startsWith('https://')) {
        return input;
    }
    // If already a relative /uploads URL, keep it
    if (input.startsWith('/uploads/')) {
        return input;
    }
    // Check if it's base64 or data URI
    let base64Data = input;
    let ext = 'jpg';
    if (input.includes(';base64,')) {
        const parts = input.split(';base64,');
        if (parts[0].includes('png'))
            ext = 'png';
        else if (parts[0].includes('webp'))
            ext = 'webp';
        base64Data = parts[1];
    }
    else if (input.startsWith('data:')) {
        return input;
    }
    try {
        const uploadsDir = path_1.default.resolve(process.cwd(), 'public/uploads/kyc');
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        const cleanDocType = docType.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const filename = `${driverId.replace(/[^a-z0-9]/gi, '_')}_${cleanDocType}_${Date.now()}.${ext}`;
        const filePath = path_1.default.join(uploadsDir, filename);
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length < 10) {
            return input.startsWith('data:') ? input : null;
        }
        fs_1.default.writeFileSync(filePath, buffer);
        logger_js_1.logger.info(`Saved KYC document for driver ${driverId} to ${filePath} (${buffer.length} bytes)`);
        return `/uploads/kyc/${filename}`;
    }
    catch (err) {
        logger_js_1.logger.warn(`Could not write KYC image to disk, keeping direct payload for driver ${driverId}`);
        return input.startsWith('data:') ? input : null;
    }
}
function normalizePhone(rawPhone) {
    if (!rawPhone)
        return '';
    const digits = rawPhone.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    return last10.length === 10 ? `+91${last10}` : rawPhone.trim();
}
class AuthService {
    async sendOtp(phone, role) {
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone || normalizedPhone.replace(/\D/g, '').length < 10) {
            throw new errors_js_1.BadRequestError('Invalid phone number format');
        }
        const { sessionToken, expiresInSeconds, devOtp } = sms_js_1.smsService.generateOtp(normalizedPhone);
        return {
            sessionToken,
            expiresInSeconds,
            ...(index_js_1.config.env !== 'production' ? { devOtp } : {})
        };
    }
    async verifyOtp(phone, otp, sessionToken, requestedRole = shared_1.UserRole.CUSTOMER, name) {
        const normalizedPhone = normalizePhone(phone);
        const isValid = sms_js_1.smsService.verifyOtp(normalizedPhone, otp, sessionToken) || sms_js_1.smsService.verifyOtp(phone, otp, sessionToken);
        if (!isValid) {
            throw new errors_js_1.BadRequestError('Invalid or expired OTP');
        }
        let user = await db_js_1.db.users.findByPhone(normalizedPhone);
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await db_js_1.db.users.create({
                phone: normalizedPhone,
                name: name || (requestedRole === shared_1.UserRole.DRIVER ? 'Partner Driver' : 'Justcomes Customer'),
                preferredLanguage: 'hi',
                role: requestedRole,
                isActive: requestedRole === shared_1.UserRole.DRIVER ? false : true,
                isVerified: true
            });
        }
        else {
            const updates = {};
            if (user.phone !== normalizedPhone)
                updates.phone = normalizedPhone;
            if (name && (!user.name || user.name === 'Partner Driver' || user.name.includes('Driver A')))
                updates.name = name;
            if (requestedRole === shared_1.UserRole.DRIVER && user.role !== shared_1.UserRole.DRIVER && user.role !== shared_1.UserRole.SUPER_ADMIN) {
                updates.role = shared_1.UserRole.DRIVER;
            }
            if (Object.keys(updates).length > 0) {
                user = (await db_js_1.db.users.update(user.id, updates)) || user;
            }
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
        const normalizedPhone = normalizePhone(data.phone);
        let user = await db_js_1.db.users.findByPhone(normalizedPhone);
        if (!user) {
            user = await db_js_1.db.users.create({
                phone: normalizedPhone,
                name: data.name.trim(),
                role: shared_1.UserRole.DRIVER,
                isActive: false, // Inactive / Requested until Admin approves KYC
                isVerified: false,
                preferredLanguage: 'hi'
            });
        }
        else {
            user = await db_js_1.db.users.update(user.id, {
                phone: normalizedPhone,
                name: data.name.trim(),
                role: shared_1.UserRole.DRIVER,
                isActive: false,
                isVerified: false
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
        // Documents setup - strictly use driver uploaded documents with NO unsplash dummy fallbacks
        const docs = data.uploadedDocs || {};
        const savedDl = saveDocumentImage(driver.id, 'dl', docs.dl);
        const savedRc = saveDocumentImage(driver.id, 'rc', docs.rc);
        const savedIns = saveDocumentImage(driver.id, 'insurance', docs.insurance);
        const savedSelfie = saveDocumentImage(driver.id, 'selfie', docs.selfie);
        if (savedSelfie) {
            user.avatarUrl = savedSelfie;
            await db_js_1.db.users.update(user.id, { avatarUrl: savedSelfie });
        }
        const documentSpecs = [
            { type: 'DRIVING_LICENSE_FRONT', number: data.dlNumber, url: savedDl || (typeof docs.dl === 'string' ? docs.dl : '') },
            { type: 'VEHICLE_RC', number: data.rcNumber, url: savedRc || (typeof docs.rc === 'string' ? docs.rc : '') },
            { type: 'VEHICLE_INSURANCE', number: data.insuranceNumber, url: savedIns || (typeof docs.insurance === 'string' ? docs.insurance : '') },
            { type: 'DRIVER_PHOTO_SELFIE', number: undefined, url: savedSelfie || (typeof docs.selfie === 'string' ? docs.selfie : '') }
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
