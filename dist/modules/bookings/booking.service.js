"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingService = exports.BookingService = void 0;
const db_js_1 = require("../../services/db.js");
const pricing_service_js_1 = require("../pricing/pricing.service.js");
const dispatch_service_js_1 = require("../dispatch/dispatch.service.js");
const socket_service_js_1 = require("../socket/socket.service.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const logger_js_1 = require("../../common/logger.js");
class BookingService {
    /**
     * Generates a unique, memorable booking code (e.g. GTG-202610-8472)
     */
    generateBookingCode() {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        return `GTG-${yearMonth}-${randomSuffix}`;
    }
    /**
     * Creates an online customer booking and initiates dispatch
     */
    async createCustomerBooking(input) {
        const { customerId, pickup, destination, vehicleCategory, bookingType = shared_1.BookingType.ONE_WAY, paymentMethod = shared_1.PaymentMethod.CASH } = input;
        const distanceKm = pricing_service_js_1.pricingService.calculateDistanceKm(pickup, destination);
        const durationMinutes = pricing_service_js_1.pricingService.estimateDurationMinutes(distanceKm, bookingType === shared_1.BookingType.OUTSTATION);
        const estimatedFare = pricing_service_js_1.pricingService.computeFare(vehicleCategory, distanceKm, durationMinutes);
        // Generate 4-digit ride OTP for passenger verification
        const rideOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const bookingCode = this.generateBookingCode();
        const booking = await db_js_1.db.bookings.create({
            bookingCode,
            bookingSource: shared_1.BookingSource.CUSTOMER_APP,
            bookingType,
            status: shared_1.BookingStatus.PENDING_DISPATCH,
            customerId,
            vehicleCategory,
            pickupAddress: pickup.address || `${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}`,
            pickupLatitude: pickup.latitude,
            pickupLongitude: pickup.longitude,
            destinationAddress: destination.address || `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`,
            destinationLatitude: destination.latitude,
            destinationLongitude: destination.longitude,
            scheduledPickupTime: input.scheduledPickupTime || new Date(),
            estimatedDistanceKm: distanceKm,
            estimatedDurationMinutes: durationMinutes,
            estimatedFare,
            advancePaid: 0,
            remainingCustomerBalance: estimatedFare,
            paymentMethod,
            paymentStatus: shared_1.PaymentStatus.PENDING,
            rideOtp
        });
        logger_js_1.logger.info(`Customer Booking created: ${booking.bookingCode} (Fare: ₹${estimatedFare}, OTP: ${rideOtp})`);
        // Initiate dispatch to nearby online drivers asynchronously
        dispatch_service_js_1.dispatchService.dispatchBooking(booking.id).catch((err) => {
            logger_js_1.logger.error(`Error in dispatching booking ${booking.id}:`, err);
        });
        return booking;
    }
    /**
     * Retrieves booking details with complete driver and vehicle context
     */
    async getBookingDetails(bookingId) {
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking) {
            throw new errors_js_1.NotFoundError('Booking not found');
        }
        let customer = null;
        if (booking.customerId) {
            customer = await db_js_1.db.customerProfiles.findById(booking.customerId);
        }
        let driver = null;
        let driverUser = null;
        let vehicle = null;
        let liveLocation = null;
        if (booking.assignedDriverId) {
            driver = await db_js_1.db.driverProfiles.findById(booking.assignedDriverId);
            if (driver) {
                driverUser = await db_js_1.db.users.findById(driver.userId);
                const vehicles = await db_js_1.db.vehicles.findByDriverId(driver.id);
                vehicle = vehicles.length > 0 ? vehicles[0] : null;
                liveLocation = await db_js_1.db.driverAvailability.findByDriverId(driver.id);
            }
        }
        return {
            booking,
            customer: customer ? { id: customer.id, rating: customer.ratingAverage } : null,
            assignedDriver: driver && driverUser ? {
                id: driver.id,
                name: driverUser.name,
                phone: driverUser.phone,
                ratingAverage: driver.ratingAverage,
                vehicle: vehicle ? {
                    make: vehicle.make,
                    model: vehicle.model,
                    color: vehicle.color,
                    registrationNumber: vehicle.registrationNumber
                } : null,
                liveLocation: liveLocation ? {
                    latitude: liveLocation.currentLatitude,
                    longitude: liveLocation.currentLongitude,
                    heading: liveLocation.heading,
                    speedKmh: liveLocation.speedKmh,
                    lastPingAt: liveLocation.lastPingAt
                } : null
            } : null
        };
    }
    /**
     * Cancels a booking with reason logging
     */
    async cancelBooking(bookingId, actorId, reason, cancelledBy) {
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking)
            throw new errors_js_1.NotFoundError('Booking not found');
        if (booking.status === shared_1.BookingStatus.COMPLETED || booking.status === shared_1.BookingStatus.CANCELLED) {
            throw new errors_js_1.BadRequestError(`Cannot cancel a booking that is already ${booking.status}`);
        }
        const updated = await db_js_1.db.bookings.update(bookingId, {
            status: shared_1.BookingStatus.CANCELLED,
            cancellationReason: reason,
            cancelledBy
        });
        socket_service_js_1.socketService.emitBookingStatusUpdated(bookingId, shared_1.BookingStatus.CANCELLED, { reason, cancelledBy });
        return updated;
    }
    /**
     * Submits passenger rating for the trip
     */
    async rateBooking(bookingId, customerId, score, comment) {
        if (score < 1 || score > 5) {
            throw new errors_js_1.BadRequestError('Score must be between 1 and 5');
        }
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking)
            throw new errors_js_1.NotFoundError('Booking not found');
        if (booking.status !== shared_1.BookingStatus.COMPLETED) {
            throw new errors_js_1.BadRequestError('Only completed trips can be rated');
        }
        if (booking.customerId !== customerId) {
            throw new errors_js_1.ForbiddenError('Only the booking customer can rate this trip');
        }
        if (booking.assignedDriverId) {
            const driver = await db_js_1.db.driverProfiles.findById(booking.assignedDriverId);
            if (driver) {
                // Recompute weighted average rating
                const totalTrips = driver.totalCompletedTrips || 1;
                const currentAvg = Number(driver.ratingAverage);
                const newAvg = Number(((currentAvg * (totalTrips - 1) + score) / totalTrips).toFixed(2));
                await db_js_1.db.driverProfiles.update(driver.id, {
                    ratingAverage: newAvg
                });
            }
        }
        return {
            bookingId,
            score,
            comment,
            submittedAt: new Date()
        };
    }
}
exports.BookingService = BookingService;
exports.bookingService = new BookingService();
