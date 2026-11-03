"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const db_js_1 = require("../../services/db.js");
const errors_js_1 = require("../../common/errors.js");
const socket_service_js_1 = require("../socket/socket.service.js");
const router = (0, express_1.Router)();
// Get driver profile & duty state
router.get('/profile', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER, shared_1.UserRole.SUPER_ADMIN), async (req, res, next) => {
    try {
        const user = await db_js_1.db.users.findById(req.user.id);
        const driver = await db_js_1.db.driverProfiles.findByUserId(req.user.id);
        if (!driver) {
            throw new errors_js_1.NotFoundError('Driver profile not found');
        }
        const vehicles = await db_js_1.db.vehicles.findByDriverId(driver.id);
        const documents = await db_js_1.db.driverDocuments.findByDriverId(driver.id);
        const availability = await db_js_1.db.driverAvailability.findByDriverId(driver.id);
        const wallet = await db_js_1.db.wallets.findByUserId(user.id);
        res.json({
            success: true,
            data: {
                user,
                driver,
                vehicles,
                documents,
                availability,
                wallet
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// Query KYC status by phone or driver ID (quick sync for mobile driver app)
router.get('/kyc-status/:phoneOrDriverId', async (req, res, next) => {
    try {
        const { phoneOrDriverId } = req.params;
        let driver = await db_js_1.db.driverProfiles.findById(phoneOrDriverId);
        let user = null;
        if (!driver) {
            user = await db_js_1.db.users.findByPhone(phoneOrDriverId);
            if (user) {
                driver = await db_js_1.db.driverProfiles.findByUserId(user.id);
            }
        }
        else {
            user = await db_js_1.db.users.findById(driver.userId);
        }
        if (!driver) {
            throw new errors_js_1.NotFoundError('Driver profile not found');
        }
        res.json({
            success: true,
            data: {
                driverId: driver.id,
                name: user?.name,
                phone: user?.phone,
                kycStatus: driver.kycStatus,
                kycRejectionReason: driver.kycRejectionReason,
                isVerified: driver.kycStatus === shared_1.KycStatus.VERIFIED
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// Update driver profile (banking/UPI & service city)
router.put('/profile', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { serviceCity, operatingState, bankAccountHolder, bankAccountNumber, bankIfscCode, upiId, experienceYears } = req.body;
        if (!req.user.driverId) {
            throw new errors_js_1.BadRequestError('Driver profile not found');
        }
        const updated = await db_js_1.db.driverProfiles.update(req.user.driverId, {
            ...(serviceCity ? { serviceCity } : {}),
            ...(operatingState ? { operatingState } : {}),
            ...(bankAccountHolder ? { bankAccountHolder } : {}),
            ...(bankAccountNumber ? { bankAccountNumber } : {}),
            ...(bankIfscCode ? { bankIfscCode } : {}),
            ...(upiId ? { upiId } : {}),
            ...(experienceYears ? { experienceYears: parseInt(experienceYears, 10) } : {})
        });
        res.json({
            success: true,
            message: 'Driver profile updated',
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
// Upload KYC document
router.post('/kyc/documents', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { documentType, fileUrl, documentNumber, expiryDate } = req.body;
        if (!documentType || !fileUrl) {
            throw new errors_js_1.BadRequestError('documentType and fileUrl are required');
        }
        if (!req.user.driverId) {
            throw new errors_js_1.BadRequestError('Driver profile not linked');
        }
        const doc = await db_js_1.db.driverDocuments.create({
            driverId: req.user.driverId,
            documentType,
            fileUrl,
            documentNumber,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            verificationStatus: 'PENDING'
        });
        // If driver was in PENDING, move to UNDER_REVIEW
        await db_js_1.db.driverProfiles.update(req.user.driverId, {
            kycStatus: shared_1.KycStatus.UNDER_REVIEW
        });
        res.status(201).json({
            success: true,
            message: 'Document uploaded for verification',
            data: doc
        });
    }
    catch (err) {
        next(err);
    }
});
// Register a vehicle
router.post('/vehicles', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { category, registrationNumber, make, model, color, year, seatingCapacity = 4, isAc = true, rcNumber } = req.body;
        if (!category || !registrationNumber || !make || !model) {
            throw new errors_js_1.BadRequestError('Category, registrationNumber, make, and model are required');
        }
        if (!req.user.driverId) {
            throw new errors_js_1.BadRequestError('Driver profile not linked');
        }
        const vehicle = await db_js_1.db.vehicles.create({
            driverId: req.user.driverId,
            category: category,
            registrationNumber: registrationNumber.toUpperCase().trim(),
            make,
            model,
            color: color || 'White',
            year: year ? parseInt(year, 10) : 2022,
            seatingCapacity: parseInt(seatingCapacity, 10),
            isAc: Boolean(isAc),
            rcNumber,
            isVerified: false,
            isActive: true
        });
        res.status(201).json({
            success: true,
            message: 'Vehicle registered successfully',
            data: vehicle
        });
    }
    catch (err) {
        next(err);
    }
});
// Toggle Online / Offline Duty
router.post('/availability/toggle', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { isOnline, latitude = 23.3441, longitude = 85.3096 } = req.body;
        if (!req.user.driverId) {
            throw new errors_js_1.BadRequestError('Driver profile not linked');
        }
        const driver = await db_js_1.db.driverProfiles.findById(req.user.driverId);
        if (!driver || driver.kycStatus !== shared_1.KycStatus.VERIFIED) {
            throw new errors_js_1.ForbiddenError('Driver KYC must be verified by admin before taking rides online');
        }
        const availability = await db_js_1.db.driverAvailability.upsert(req.user.driverId, {
            isOnline: Boolean(isOnline),
            currentLatitude: Number(latitude),
            currentLongitude: Number(longitude)
        });
        // Broadcast online status to socket room
        socket_service_js_1.socketService.notifyDriverDutyStatus(req.user.driverId, Boolean(isOnline));
        res.json({
            success: true,
            message: `Driver is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`,
            data: availability
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver GPS location ping
router.post('/location/ping', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { latitude, longitude, heading, speedKmh } = req.body;
        if (latitude === undefined || longitude === undefined) {
            throw new errors_js_1.BadRequestError('Latitude and longitude are required');
        }
        const driverId = req.user.driverId;
        const updated = await db_js_1.db.driverAvailability.upsert(driverId, {
            currentLatitude: Number(latitude),
            currentLongitude: Number(longitude),
            heading: heading !== undefined ? Number(heading) : undefined,
            speedKmh: speedKmh !== undefined ? Number(speedKmh) : undefined
        });
        // Real-time broadcast to interested subscribers (e.g. Driver A tracking Driver B or Customer tracking Driver)
        socket_service_js_1.socketService.broadcastDriverLocation({
            driverId,
            latitude: Number(latitude),
            longitude: Number(longitude),
            heading: heading ? Number(heading) : 0,
            speedKmh: speedKmh ? Number(speedKmh) : 0,
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            data: {
                recordedAt: updated.lastPingAt
            }
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
