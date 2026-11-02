"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const booking_service_js_1 = require("./booking.service.js");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const db_js_1 = require("../../services/db.js");
const router = (0, express_1.Router)();
// Create new customer booking
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER), async (req, res, next) => {
    try {
        const { pickup, destination, vehicleCategory, bookingType, paymentMethod, scheduledPickupTime } = req.body;
        if (!pickup || !destination || !vehicleCategory) {
            throw new errors_js_1.BadRequestError('pickup, destination, and vehicleCategory are required');
        }
        if (!req.user.customerId) {
            throw new errors_js_1.BadRequestError('Customer profile not initialized');
        }
        const booking = await booking_service_js_1.bookingService.createCustomerBooking({
            customerId: req.user.customerId,
            pickup,
            destination,
            vehicleCategory,
            bookingType,
            paymentMethod,
            scheduledPickupTime: scheduledPickupTime ? new Date(scheduledPickupTime) : undefined
        });
        res.status(201).json({
            success: true,
            message: 'Booking created. Dispatching to nearby drivers.',
            data: booking
        });
    }
    catch (err) {
        next(err);
    }
});
// List customer rides
router.get('/my-rides', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER), async (req, res, next) => {
    try {
        if (!req.user.customerId) {
            return res.json({ success: true, data: [] });
        }
        const rides = await db_js_1.db.bookings.findByCustomerId(req.user.customerId);
        res.json({
            success: true,
            data: rides
        });
    }
    catch (err) {
        next(err);
    }
});
// Get booking details
router.get('/:id', auth_js_1.authenticateToken, async (req, res, next) => {
    try {
        const details = await booking_service_js_1.bookingService.getBookingDetails(req.params.id);
        res.json({
            success: true,
            data: details
        });
    }
    catch (err) {
        next(err);
    }
});
// Cancel booking
router.post('/:id/cancel', auth_js_1.authenticateToken, async (req, res, next) => {
    try {
        const { reason = 'Cancelled by user' } = req.body;
        const cancelledBy = req.user.role === shared_1.UserRole.CUSTOMER ? 'CUSTOMER' : 'DRIVER';
        const updated = await booking_service_js_1.bookingService.cancelBooking(req.params.id, req.user.id, reason, cancelledBy);
        res.json({
            success: true,
            message: 'Booking cancelled',
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
// Rate completed booking
router.post('/:id/rate', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER), async (req, res, next) => {
    try {
        const { score, comment } = req.body;
        if (score === undefined) {
            throw new errors_js_1.BadRequestError('Score is required');
        }
        const rating = await booking_service_js_1.bookingService.rateBooking(req.params.id, req.user.customerId, Number(score), comment);
        res.json({
            success: true,
            message: 'Trip rating submitted successfully',
            data: rating
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
