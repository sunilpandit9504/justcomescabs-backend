"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const offline_booking_service_js_1 = require("./offline-booking.service.js");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const router = (0, express_1.Router)();
// Create offline booking
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { customerName, customerPhone, channelSource, tripType, vehicleCategory, pickup, destination, scheduledPickupTime, agreedTotalFare, advancePaid, specialInstructions, customerNotes, luggageCount, returnDateTime, advancePaymentMethod } = req.body;
        if (!req.user.driverId) {
            throw new errors_js_1.BadRequestError('Driver profile not linked to user');
        }
        const result = await offline_booking_service_js_1.offlineBookingService.createOfflineBooking({
            creatorDriverId: req.user.driverId,
            customerName,
            customerPhone,
            channelSource,
            tripType,
            vehicleCategory,
            pickup,
            destination,
            scheduledPickupTime: scheduledPickupTime ? new Date(scheduledPickupTime) : new Date(),
            agreedTotalFare: Number(agreedTotalFare),
            advancePaid: advancePaid ? Number(advancePaid) : 0,
            specialInstructions,
            customerNotes,
            luggageCount: luggageCount ? Number(luggageCount) : 1,
            returnDateTime,
            advancePaymentMethod
        });
        res.status(201).json({
            success: true,
            message: 'Offline booking created successfully',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
// List driver's offline bookings
router.get('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        if (!req.user.driverId) {
            return res.json({ success: true, data: [] });
        }
        const bookings = await offline_booking_service_js_1.offlineBookingService.getMyOfflineBookings(req.user.driverId);
        res.json({
            success: true,
            data: bookings
        });
    }
    catch (err) {
        next(err);
    }
});
// View single offline booking details
router.get('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const details = await offline_booking_service_js_1.offlineBookingService.getOfflineBookingById(req.params.id, req.user.driverId);
        res.json({
            success: true,
            data: details
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
