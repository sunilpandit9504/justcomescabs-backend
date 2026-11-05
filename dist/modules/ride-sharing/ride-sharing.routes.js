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
// Driver A publishes offline booking to sharing pool
router.post('/publish', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { bookingId, sharingMode, directTargetDriverId, commissionType, commissionValue, expiresInMinutes } = req.body;
        if (!bookingId) {
            throw new errors_js_1.BadRequestError('bookingId is required');
        }
        const driverId = await resolveDriverId(req);
        const result = await ride_sharing_service_js_1.rideSharingService.publishForSharing({
            creatorDriverId: driverId,
            bookingId,
            sharingMode,
            directTargetDriverId,
            commissionType,
            commissionValue: commissionValue ? Number(commissionValue) : undefined,
            expiresInMinutes: expiresInMinutes ? Number(expiresInMinutes) : undefined
        });
        res.status(200).json({
            success: true,
            message: 'Offline booking published for peer driver sharing',
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
