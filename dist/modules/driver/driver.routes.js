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
        const rawParam = decodeURIComponent(req.params.phoneOrDriverId || '').trim();
        let driver = await db_js_1.db.driverProfiles.findById(rawParam);
        let user = null;
        if (!driver) {
            user = await db_js_1.db.users.findByPhone(rawParam);
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
        const documents = await db_js_1.db.driverDocuments.findByDriverId(driver.id);
        const vehicles = await db_js_1.db.vehicles.findByDriverId(driver.id);
        res.json({
            success: true,
            data: {
                driverId: driver.id,
                name: user?.name,
                phone: user?.phone,
                kycStatus: driver.kycStatus,
                kycRejectionReason: driver.kycRejectionReason,
                isVerified: driver.kycStatus === shared_1.KycStatus.VERIFIED,
                documents,
                vehicles
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
// Driver Ride History
router.get('/history', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER, shared_1.UserRole.SUPER_ADMIN), async (req, res, next) => {
    try {
        let driverId = req.user?.driverId;
        if (!driverId && req.user?.id) {
            const driver = await db_js_1.db.driverProfiles.findByUserId(req.user.id);
            driverId = driver?.id;
        }
        if (!driverId) {
            return res.json({ success: true, data: [] });
        }
        const allBookings = await db_js_1.db.bookings.listAll();
        const driverBookings = allBookings.filter(b => b.assignedDriverId === driverId || b.creatorDriverId === driverId);
        // Sort descending by creation date
        driverBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const result = await Promise.all(driverBookings.map(async (b) => {
            let customerName = 'Customer';
            let customerPhone = '';
            if (b.customerId) {
                const cust = await db_js_1.db.customerProfiles.findById(b.customerId);
                if (cust) {
                    const user = await db_js_1.db.users.findById(cust.userId);
                    if (user) {
                        customerName = user.name;
                        customerPhone = user.phone;
                    }
                }
            }
            const offline = await db_js_1.db.offlineBookingDetails.findByBookingId(b.id);
            if (offline) {
                customerName = offline.offlineCustomerName;
                customerPhone = offline.offlineCustomerPhone;
            }
            return {
                id: b.id,
                bookingCode: b.bookingCode,
                status: b.status,
                bookingSource: b.bookingSource,
                bookingType: b.bookingType,
                customerName,
                customerPhone,
                pickupAddress: b.pickupAddress,
                dropAddress: b.destinationAddress,
                destinationAddress: b.destinationAddress,
                fare: b.finalFare || b.estimatedFare || 0,
                estimatedFare: b.estimatedFare,
                finalFare: b.finalFare || b.estimatedFare,
                advancePaid: b.advancePaid || 0,
                remainingCustomerBalance: b.remainingCustomerBalance || 0,
                paymentMethod: b.paymentMethod,
                paymentStatus: b.paymentStatus,
                date: new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                time: new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                createdAt: b.createdAt.toISOString(),
                vehicleCategory: b.vehicleCategory,
                rating: 5.0
            };
        }));
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver Performance & Earnings Analytics
router.get('/performance', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER, shared_1.UserRole.SUPER_ADMIN), async (req, res, next) => {
    try {
        let driverId = req.user?.driverId;
        if (!driverId && req.user?.id) {
            const driver = await db_js_1.db.driverProfiles.findByUserId(req.user.id);
            driverId = driver?.id;
        }
        const period = (req.query.period || 'DAY').toUpperCase(); // 'DAY' | 'WEEK' | 'MONTH'
        if (!driverId) {
            return res.json({
                success: true,
                data: {
                    period,
                    totalEarnings: 0,
                    totalRides: 0,
                    hoursOnline: 0,
                    avgPerRide: 0,
                    barData: [],
                    breakdowns: []
                }
            });
        }
        const allBookings = await db_js_1.db.bookings.listAll();
        const myBookings = allBookings.filter(b => b.assignedDriverId === driverId || b.creatorDriverId === driverId);
        const now = new Date();
        let filterStart = new Date(now);
        if (period === 'WEEK') {
            filterStart.setDate(now.getDate() - 7);
        }
        else if (period === 'MONTH') {
            filterStart.setDate(now.getDate() - 30);
        }
        else {
            // DAY (today starting 00:00:00)
            filterStart.setHours(0, 0, 0, 0);
        }
        const periodBookings = myBookings.filter(b => new Date(b.createdAt) >= filterStart);
        const completedBookings = periodBookings.filter(b => b.status === 'COMPLETED');
        const totalEarnings = completedBookings.reduce((sum, b) => sum + Number(b.finalFare || b.estimatedFare || 0), 0);
        const totalRides = completedBookings.length;
        const avgPerRide = totalRides > 0 ? Math.round((totalEarnings / totalRides) * 100) / 100 : 0;
        const hoursOnline = Math.min(12, Math.max(0.0, totalRides * 0.75));
        // Dynamic Bar Data
        let barData = [];
        if (period === 'DAY') {
            const slots = [
                { label: '6-9 AM', start: 6, end: 9 },
                { label: '9-12 PM', start: 9, end: 12 },
                { label: '12-3 PM', start: 12, end: 15 },
                { label: '3-6 PM', start: 15, end: 18 },
                { label: '6-9 PM', start: 18, end: 21 },
                { label: '9-12 AM', start: 21, end: 24 }
            ];
            barData = slots.map(s => {
                const ridesInSlot = completedBookings.filter(b => {
                    const h = new Date(b.createdAt).getHours();
                    return h >= s.start && h < s.end;
                });
                const slotEarnings = ridesInSlot.reduce((acc, b) => acc + Number(b.finalFare || b.estimatedFare || 0), 0);
                return { label: s.label, earnings: slotEarnings, rides: ridesInSlot.length };
            });
        }
        else if (period === 'WEEK') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            barData = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const dayStr = days[d.getDay()];
                const dayDate = d.toISOString().split('T')[0];
                const ridesOnDay = completedBookings.filter(b => new Date(b.createdAt).toISOString().split('T')[0] === dayDate);
                const dayEarnings = ridesOnDay.reduce((acc, b) => acc + Number(b.finalFare || b.estimatedFare || 0), 0);
                barData.push({ label: dayStr, earnings: dayEarnings, rides: ridesOnDay.length });
            }
        }
        else {
            // MONTH (4 weeks)
            barData = [
                { label: 'Wk 1', earnings: 0, rides: 0 },
                { label: 'Wk 2', earnings: 0, rides: 0 },
                { label: 'Wk 3', earnings: 0, rides: 0 },
                { label: 'Wk 4', earnings: 0, rides: 0 }
            ];
            completedBookings.forEach(b => {
                const rideDate = new Date(b.createdAt);
                const diffDays = Math.floor((now.getTime() - rideDate.getTime()) / (1000 * 60 * 60 * 24));
                const weekIdx = Math.min(3, Math.floor(diffDays / 7));
                const slot = barData[3 - weekIdx];
                if (slot) {
                    slot.earnings += Number(b.finalFare || b.estimatedFare || 0);
                    slot.rides += 1;
                }
            });
        }
        // Dynamic Breakdown List
        const breakdowns = completedBookings.slice(0, 10).map((b) => ({
            title: `${b.bookingCode} • ${b.pickupAddress.split(',')[0]} → ${b.destinationAddress.split(',')[0]}`,
            rides: 1,
            hours: `${b.estimatedDurationMinutes ? (b.estimatedDurationMinutes / 60).toFixed(1) : '0.5'}h`,
            earnings: Number(b.finalFare || b.estimatedFare || 0)
        }));
        res.json({
            success: true,
            data: {
                period,
                totalEarnings,
                totalRides,
                hoursOnline,
                avgPerRide,
                barData,
                breakdowns
            }
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
