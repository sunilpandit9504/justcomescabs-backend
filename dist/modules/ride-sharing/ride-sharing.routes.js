"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ride_sharing_service_js_1 = require("./ride-sharing.service.js");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const tracking_service_js_1 = require("./tracking.service.js");
const router = (0, express_1.Router)();
const db_js_1 = require("../../services/db.js");
async function resolveDriverId(req) {
    let driverId = req.user?.driverId;
    if (!driverId && req.user?.id) {
        const driver = await db_js_1.db.driverProfiles.findByUserId(req.user.id);
        driverId = driver?.id;
    }
    if (!driverId && req.user?.phone) {
        const u = await db_js_1.db.users.findByPhone(req.user.phone);
        if (u) {
            const d = await db_js_1.db.driverProfiles.findByUserId(u.id);
            driverId = d?.id;
        }
    }
    if (!driverId) {
        throw new errors_js_1.BadRequestError('Driver profile not linked to user');
    }
    return driverId;
}
// Driver A tracks Driver B's authorized live location, timeline & commission
router.get('/:bookingId/live-tracking', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const driverId = await resolveDriverId(req);
        const trackingData = await tracking_service_js_1.trackingService.getDriverALiveTracking(req.params.bookingId, driverId);
        res.json({
            success: true,
            data: trackingData
        });
    }
    catch (err) {
        next(err);
    }
});
// Search registered drivers for direct friend sharing
router.get('/search-drivers', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const callerDriverId = await resolveDriverId(req);
        const query = String(req.query.q || req.query.query || '').trim().toLowerCase();
        const allDrivers = await db_js_1.db.driverProfiles.listAll();
        const results = [];
        for (const driver of allDrivers) {
            if (driver.id === callerDriverId)
                continue; // Exclude caller driver
            const user = await db_js_1.db.users.findById(driver.userId);
            if (!user)
                continue;
            const name = user.name || 'Driver Partner';
            const phone = user.phone || '';
            const city = driver.serviceCity || 'Ranchi, JH';
            if (query) {
                const matches = name.toLowerCase().includes(query) ||
                    phone.toLowerCase().includes(query) ||
                    city.toLowerCase().includes(query);
                if (!matches)
                    continue;
            }
            const vehicles = await db_js_1.db.vehicles.findByDriverId(driver.id);
            const vehicleDesc = vehicles[0]
                ? `${vehicles[0].category || 'Cab'} • ${vehicles[0].model || 'Vehicle'} (${vehicles[0].registrationNumber || ''})`.trim()
                : 'Sedan / Cab';
            const availability = await db_js_1.db.driverAvailability.findByDriverId(driver.id);
            results.push({
                id: driver.id,
                driverId: driver.id,
                name,
                phone,
                formatted: `${name} ( ${phone} )`,
                city,
                vehicle: vehicleDesc,
                rating: `${(driver.rating || 4.9).toFixed(1)} ★`,
                isOnline: availability ? availability.isOnline : true,
                kycStatus: driver.kycStatus
            });
        }
        res.json({
            success: true,
            data: results
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver A publishes offline booking to sharing pool
router.post('/publish', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { bookingId, sharingMode, directTargetDriverId, commissionType, commissionValue, expiresInMinutes } = req.body;
        if (!bookingId) {
            throw new errors_js_1.BadRequestError('bookingId is required');
        }
        const driverId = await resolveDriverId(req);
        // Normalize sharing mode
        const mode = (sharingMode === 'DIRECT_DRIVER' || sharingMode === 'DIRECT_OFFER')
            ? 'DIRECT_OFFER'
            : 'OPEN_DRIVER_NETWORK';
        // Resolve direct target driver ID cleanly if provided
        let targetDriverId = directTargetDriverId;
        if (targetDriverId) {
            const cleanTarget = String(targetDriverId).trim();
            // 1. Direct match by ID
            const directMatch = await db_js_1.db.driverProfiles.findById(cleanTarget);
            if (directMatch) {
                targetDriverId = directMatch.id;
            }
            else {
                // 2. Extract 10-digit phone number if phone or formatted string passed
                const digits = cleanTarget.replace(/\D/g, '');
                if (digits.length >= 10) {
                    const tenDigit = digits.slice(-10);
                    const u = await db_js_1.db.users.findByPhone(`+91${tenDigit}`) || await db_js_1.db.users.findByPhone(tenDigit);
                    if (u) {
                        const d = await db_js_1.db.driverProfiles.findByUserId(u.id);
                        if (d)
                            targetDriverId = d.id;
                    }
                }
            }
        }
        const result = await ride_sharing_service_js_1.rideSharingService.publishForSharing({
            creatorDriverId: driverId,
            bookingId,
            sharingMode: mode,
            directTargetDriverId: targetDriverId,
            commissionType,
            commissionValue: commissionValue ? Number(commissionValue) : undefined,
            expiresInMinutes: expiresInMinutes ? Number(expiresInMinutes) : undefined
        });
        res.status(200).json({
            success: true,
            message: mode === 'DIRECT_OFFER'
                ? 'Offline booking dispatched directly to friend driver'
                : 'Offline booking published for peer driver sharing',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver B browses incoming sharing offers
router.get('/incoming-offers', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const driverId = await resolveDriverId(req);
        const offers = await ride_sharing_service_js_1.rideSharingService.getIncomingOffers(driverId);
        res.json({
            success: true,
            data: offers
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver B accepts sharing offer
router.post('/accept', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { sharingRequestId } = req.body;
        if (!sharingRequestId) {
            throw new errors_js_1.BadRequestError('sharingRequestId is required');
        }
        const driverId = await resolveDriverId(req);
        const result = await ride_sharing_service_js_1.rideSharingService.acceptSharingOffer(sharingRequestId, driverId);
        res.status(200).json({
            success: true,
            message: 'Shared ride successfully assigned to you',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver A views their shared bookings
router.get('/my-shared', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const driverId = await resolveDriverId(req);
        const sharedBookings = await ride_sharing_service_js_1.rideSharingService.getMySharedBookings(driverId);
        res.json({
            success: true,
            data: sharedBookings
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
