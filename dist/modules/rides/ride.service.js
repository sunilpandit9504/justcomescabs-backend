"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rideService = exports.RideService = void 0;
const db_js_1 = require("../../services/db.js");
const socket_service_js_1 = require("../socket/socket.service.js");
const finance_service_js_1 = require("../finance/finance.service.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const logger_js_1 = require("../../common/logger.js");
class RideService {
    /**
     * Driver marks that they are en route to the customer pickup
     */
    async markDriverArriving(bookingId, driverId) {
        const booking = await this.validateAssignedDriver(bookingId, driverId);
        if (booking.status !== shared_1.BookingStatus.ASSIGNED) {
            throw new errors_js_1.BadRequestError(`Cannot mark arriving from status ${booking.status}`);
        }
        const updated = await db_js_1.db.bookings.update(bookingId, {
            status: shared_1.BookingStatus.DRIVER_ARRIVING
        });
        socket_service_js_1.socketService.emitBookingStatusUpdated(bookingId, shared_1.BookingStatus.DRIVER_ARRIVING);
        return updated;
    }
    /**
     * Driver arrives at passenger pickup location
     */
    async markArrivedAtPickup(bookingId, driverId) {
        const booking = await this.validateAssignedDriver(bookingId, driverId);
        if (booking.status !== shared_1.BookingStatus.ASSIGNED && booking.status !== shared_1.BookingStatus.DRIVER_ARRIVING) {
            throw new errors_js_1.BadRequestError(`Cannot mark arrived from status ${booking.status}`);
        }
        const updated = await db_js_1.db.bookings.update(bookingId, {
            status: shared_1.BookingStatus.ARRIVED_AT_PICKUP
        });
        socket_service_js_1.socketService.emitBookingStatusUpdated(bookingId, shared_1.BookingStatus.ARRIVED_AT_PICKUP);
        return updated;
    }
    /**
     * Driver verifies passenger with 4-digit Ride OTP and starts trip
     */
    async startRide(bookingId, driverId, otp) {
        const booking = await this.validateAssignedDriver(bookingId, driverId);
        if (booking.status !== shared_1.BookingStatus.ARRIVED_AT_PICKUP && booking.status !== shared_1.BookingStatus.DRIVER_ARRIVING && booking.status !== shared_1.BookingStatus.ASSIGNED) {
            throw new errors_js_1.BadRequestError(`Cannot start trip from status ${booking.status}`);
        }
        // Verify Passenger OTP
        if (!otp || booking.rideOtp !== otp.trim()) {
            throw new errors_js_1.BadRequestError('Invalid ride OTP. Please ask the passenger for the 4-digit code shown in their app.');
        }
        const updated = await db_js_1.db.bookings.update(bookingId, {
            status: shared_1.BookingStatus.IN_PROGRESS,
            startTime: new Date()
        });
        socket_service_js_1.socketService.emitBookingStatusUpdated(bookingId, shared_1.BookingStatus.IN_PROGRESS, {
            startTime: updated?.startTime
        });
        logger_js_1.logger.info(`Ride started: ${booking.bookingCode} by Driver ${driverId}`);
        return updated;
    }
    /**
     * Driver completes trip, finalizes fare, reconciles payment, and credits driver wallet
     */
    async completeRide(input) {
        const { bookingId, driverId, actualDistanceKm, tollCharges = 0, parkingCharges = 0 } = input;
        const booking = await this.validateAssignedDriver(bookingId, driverId);
        if (booking.status !== shared_1.BookingStatus.IN_PROGRESS) {
            throw new errors_js_1.BadRequestError(`Cannot complete a ride that is not in progress (Current: ${booking.status})`);
        }
        const finalDistance = actualDistanceKm && actualDistanceKm > 0 ? actualDistanceKm : Number(booking.estimatedDistanceKm);
        const extraCharges = Number(tollCharges) + Number(parkingCharges);
        const finalFare = Math.round(Number(booking.estimatedFare) + extraCharges);
        const now = new Date();
        const durationMins = booking.startTime ? Math.round((now.getTime() - booking.startTime.getTime()) / (1000 * 60)) : booking.estimatedDurationMinutes;
        // Platform take rate: 15%; Driver net payout: 85%
        const platformFee = Math.round(finalFare * 0.15);
        const driverEarnings = finalFare - platformFee;
        // Update booking state
        const updated = await db_js_1.db.bookings.update(bookingId, {
            status: shared_1.BookingStatus.COMPLETED,
            endTime: now,
            actualDistanceKm: finalDistance,
            actualDurationMinutes: durationMins,
            finalFare,
            paymentStatus: shared_1.PaymentStatus.PAID
        });
        // Credit Driver Wallet (Double-entry ledger entry)
        const driver = await db_js_1.db.driverProfiles.findById(driverId);
        if (driver) {
            const driverUser = await db_js_1.db.users.findById(driver.userId);
            if (driverUser) {
                const wallet = await db_js_1.db.wallets.findByUserId(driverUser.id);
                const { balanceBefore, balanceAfter } = await db_js_1.db.wallets.updateBalance(wallet.id, driverEarnings, 'CREDIT');
                await db_js_1.db.walletTransactions.create({
                    walletId: wallet.id,
                    idempotencyKey: `TRIP_PAYOUT_${bookingId}_${Date.now()}`,
                    referenceBookingId: bookingId,
                    type: shared_1.WalletTransactionType.TRIP_EARNING,
                    direction: 'CREDIT',
                    amount: driverEarnings,
                    balanceBefore,
                    balanceAfter,
                    status: 'SETTLED',
                    description: `Earnings for completed trip ${booking.bookingCode} (Gross: ₹${finalFare}, Platform fee: ₹${platformFee})`,
                    metadata: { grossFare: finalFare, platformFee, driverEarnings, tollCharges, parkingCharges }
                });
                // Update driver completed trip counter
                await db_js_1.db.driverProfiles.update(driver.id, {
                    totalCompletedTrips: (driver.totalCompletedTrips || 0) + 1
                });
            }
        }
        // Update customer completed trip counter
        if (booking.customerId) {
            const customer = await db_js_1.db.customerProfiles.findById(booking.customerId);
            if (customer) {
                await db_js_1.db.customerProfiles.update(customer.id, {
                    totalTrips: (customer.totalTrips || 0) + 1
                });
            }
        }
        // Settle peer driver commission if this was an offline shared booking
        await finance_service_js_1.financeService.settleSharedBookingCommission(bookingId);
        socket_service_js_1.socketService.emitBookingStatusUpdated(bookingId, shared_1.BookingStatus.COMPLETED, {
            finalFare,
            actualDistanceKm: finalDistance,
            driverEarnings,
            completedAt: now
        });
        logger_js_1.logger.info(`Ride completed: ${booking.bookingCode}. Final Fare: ₹${finalFare}, Driver Net: ₹${driverEarnings}`);
        return {
            booking: updated,
            finalFare,
            driverEarnings,
            platformFee
        };
    }
    async validateAssignedDriver(bookingId, driverId) {
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking) {
            throw new errors_js_1.NotFoundError('Booking not found');
        }
        if (booking.assignedDriverId !== driverId) {
            throw new errors_js_1.ForbiddenError('Only the assigned driver can update this ride status');
        }
        return booking;
    }
}
exports.RideService = RideService;
exports.rideService = new RideService();
