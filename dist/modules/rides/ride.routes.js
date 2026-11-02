"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ride_service_js_1 = require("./ride.service.js");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const router = (0, express_1.Router)();
// Driver is en route to pickup
router.post('/:id/arriving', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const updated = await ride_service_js_1.rideService.markDriverArriving(req.params.id, req.user.driverId);
        res.json({
            success: true,
            message: 'Status updated: Driver arriving',
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver arrived at pickup
router.post('/:id/arrived', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const updated = await ride_service_js_1.rideService.markArrivedAtPickup(req.params.id, req.user.driverId);
        res.json({
            success: true,
            message: 'Status updated: Arrived at pickup',
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver starts ride with 4-digit OTP
router.post('/:id/start', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { otp } = req.body;
        if (!otp) {
            throw new errors_js_1.BadRequestError('Passenger ride OTP is required');
        }
        const updated = await ride_service_js_1.rideService.startRide(req.params.id, req.user.driverId, String(otp));
        res.json({
            success: true,
            message: 'Passenger OTP verified. Trip started successfully.',
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver completes ride
router.post('/:id/complete', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { actualDistanceKm, tollCharges, parkingCharges } = req.body;
        const result = await ride_service_js_1.rideService.completeRide({
            bookingId: req.params.id,
            driverId: req.user.driverId,
            actualDistanceKm: actualDistanceKm ? Number(actualDistanceKm) : undefined,
            tollCharges: tollCharges ? Number(tollCharges) : 0,
            parkingCharges: parkingCharges ? Number(parkingCharges) : 0
        });
        res.json({
            success: true,
            message: 'Trip completed successfully. Earnings credited to your wallet.',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
