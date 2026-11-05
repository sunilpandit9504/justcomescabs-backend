"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offlineBookingService = exports.OfflineBookingService = void 0;
const db_js_1 = require("../../services/db.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const logger_js_1 = require("../../common/logger.js");
const pricing_service_js_1 = require("../pricing/pricing.service.js");
class OfflineBookingService {
    generateOfflineBookingCode() {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        return `GTG-OFF-${yearMonth}-${randomSuffix}`;
    }
    /**
     * Driver manually enters a physical customer booking received via phone, WhatsApp, etc.
     */
    async createOfflineBooking(input) {
        const { creatorDriverId, customerName, customerPhone, channelSource = shared_1.OfflineChannelSource.PHONE_CALL, tripType = shared_1.BookingType.ONE_WAY, vehicleCategory, pickup, destination, scheduledPickupTime, agreedTotalFare, advancePaid = 0, specialInstructions, customerNotes, luggageCount = 1, returnDateTime, advancePaymentMethod = 'Direct Cash/UPI to Driver A' } = input;
        if (!customerName || !customerPhone) {
            throw new errors_js_1.BadRequestError('Customer name and phone number are required');
        }
        if (!agreedTotalFare || agreedTotalFare <= 0) {
            throw new errors_js_1.BadRequestError('Agreed total fare must be greater than zero');
        }
        const distanceKm = pricing_service_js_1.pricingService.calculateDistanceKm(pickup, destination);
        const durationMinutes = pricing_service_js_1.pricingService.estimateDurationMinutes(distanceKm, tripType === shared_1.BookingType.OUTSTATION);
        const remainingBalance = Math.max(0, agreedTotalFare - advancePaid);
        const bookingCode = this.generateOfflineBookingCode();
        // 1. Create main booking record
        const booking = await db_js_1.db.bookings.create({
            bookingCode,
            bookingSource: shared_1.BookingSource.OFFLINE_DRIVER_BOOKING,
            bookingType: tripType,
            status: shared_1.BookingStatus.CONFIRMED,
            creatorDriverId,
            vehicleCategory,
            pickupAddress: pickup.address,
            pickupLatitude: pickup.latitude,
            pickupLongitude: pickup.longitude,
            destinationAddress: destination.address,
            destinationLatitude: destination.latitude,
            destinationLongitude: destination.longitude,
            scheduledPickupTime: new Date(scheduledPickupTime),
            estimatedDistanceKm: distanceKm,
            estimatedDurationMinutes: durationMinutes,
            estimatedFare: agreedTotalFare,
            finalFare: agreedTotalFare,
            advancePaid,
            remainingCustomerBalance: remainingBalance,
            paymentMethod: shared_1.PaymentMethod.CASH,
            paymentStatus: advancePaid > 0 ? shared_1.PaymentStatus.PARTIALLY_PAID : shared_1.PaymentStatus.PENDING,
            rideOtp: Math.floor(1000 + Math.random() * 9000).toString()
        });
        // 2. Create offline-specific details record
        const details = await db_js_1.db.offlineBookingDetails.create({
            bookingId: booking.id,
            offlineCustomerName: customerName,
            offlineCustomerPhone: customerPhone,
            channelSource,
            specialInstructions,
            customerNotes,
            luggageCount,
            returnDateTime: returnDateTime ? new Date(returnDateTime) : undefined,
            isAdvanceVerified: advancePaid > 0,
            advancePaymentMethod
        });
        logger_js_1.logger.info(`Offline Booking created: ${booking.bookingCode} by Driver ${creatorDriverId} (Customer: ${customerName}, Fare: ₹${agreedTotalFare}, Advance: ₹${advancePaid})`);
        return { booking, details };
    }
    /**
     * Returns all offline bookings created by the given driver
     */
    async getMyOfflineBookings(creatorDriverId) {
        const allBookings = await db_js_1.db.bookings.listAll();
        const bookings = allBookings.filter(b => b.bookingSource === shared_1.BookingSource.OFFLINE_DRIVER_BOOKING &&
            (b.creatorDriverId === creatorDriverId || b.assignedDriverId === creatorDriverId));
        bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return Promise.all(bookings.map(async (booking) => {
            const details = await db_js_1.db.offlineBookingDetails.findByBookingId(booking.id);
            const sharingRequest = await db_js_1.db.rideSharingRequests.findByBookingId(booking.id);
            let assignedDriver = null;
            if (booking.assignedDriverId) {
                const d = await db_js_1.db.driverProfiles.findById(booking.assignedDriverId);
                const user = d ? await db_js_1.db.users.findById(d.userId) : null;
                assignedDriver = d && user ? { id: d.id, name: user.name, phone: user.phone, rating: d.ratingAverage } : null;
            }
            return {
                ...booking,
                offlineDetails: details,
                sharingRequest,
                assignedDriver
            };
        }));
    }
    /**
     * Retrieves single offline booking with full creator and sharing context
     */
    async getOfflineBookingById(bookingId, driverId) {
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking) {
            throw new errors_js_1.NotFoundError('Offline booking not found');
        }
        if (booking.creatorDriverId !== driverId && booking.assignedDriverId !== driverId) {
            throw new errors_js_1.ForbiddenError('You do not have permission to view this offline booking');
        }
        const details = await db_js_1.db.offlineBookingDetails.findByBookingId(bookingId);
        const sharingRequest = await db_js_1.db.rideSharingRequests.findByBookingId(bookingId);
        const commissionAgreement = await db_js_1.db.commissionAgreements.findByBookingId(bookingId);
        return {
            booking,
            offlineDetails: details,
            sharingRequest,
            commissionAgreement
        };
    }
}
exports.OfflineBookingService = OfflineBookingService;
exports.offlineBookingService = new OfflineBookingService();
