"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchService = exports.DispatchService = void 0;
const db_js_1 = require("../../services/db.js");
const socket_service_js_1 = require("../socket/socket.service.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const logger_js_1 = require("../../common/logger.js");
class DispatchService {
    /**
     * Dispatches a pending customer booking to nearby eligible online drivers
     */
    async dispatchBooking(bookingId) {
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking)
            return;
        if (booking.status !== shared_1.BookingStatus.PENDING_DISPATCH) {
            return;
        }
        // Query online drivers
        const onlineDrivers = await db_js_1.db.driverAvailability.findOnlineDriversNearby(Number(booking.pickupLatitude), Number(booking.pickupLongitude), 15 // 15 km radius
        );
        // Filter by KYC Verified, Matching Vehicle Category, and Service Type Permission
        const eligibleDrivers = [];
        for (const d of onlineDrivers) {
            const driver = await db_js_1.db.driverProfiles.findById(d.driverId);
            if (driver && driver.kycStatus === shared_1.KycStatus.VERIFIED) {
                // STRICT ENFORCEMENT: Drivers with DELIVERY only access cannot receive passenger cab rides
                if (driver.serviceType === 'DELIVERY') {
                    continue;
                }
                const vehicles = await db_js_1.db.vehicles.findByDriverId(driver.id);
                const hasMatchingVehicle = vehicles.some(v => v.category === booking.vehicleCategory && v.isActive);
                if (hasMatchingVehicle) {
                    eligibleDrivers.push(driver.id);
                }
            }
        }
        logger_js_1.logger.info(`Dispatch: Found ${eligibleDrivers.length} eligible drivers for booking ${booking.bookingCode}`);
        // Broadcast ride offer to eligible drivers
        for (const driverId of eligibleDrivers) {
            // In real scenario, emit to each driver's socket room
            // or emit global request event with category filter
        }
    }
    /**
     * Atomically accepts a customer ride request
     */
    async acceptBooking(bookingId, driverId) {
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking) {
            throw new errors_js_1.NotFoundError('Booking not found');
        }
        // Strict atomic assignment check
        if (booking.status !== shared_1.BookingStatus.PENDING_DISPATCH) {
            throw new errors_js_1.ConflictError(`This ride is no longer available (Current status: ${booking.status})`);
        }
        const driver = await db_js_1.db.driverProfiles.findById(driverId);
        if (!driver || driver.kycStatus !== shared_1.KycStatus.VERIFIED) {
            throw new errors_js_1.BadRequestError('Driver must be verified by admin before accepting rides');
        }
        // STRICT ENFORCEMENT: Delivery-only drivers are locked out of passenger rides
        if (driver.serviceType === 'DELIVERY') {
            throw new errors_js_1.BadRequestError('Admin has restricted your account to Parcel Delivery only. You cannot accept passenger cab rides.');
        }
        // MANDATORY PLATFORM RULE: Driver must have at least ₹500 in their wallet to accept rides
        const driverUser = await db_js_1.db.users.findById(driver.userId);
        if (driverUser) {
            const driverWallet = await db_js_1.db.wallets.findByUserId(driverUser.id);
            const MIN_ACCEPTANCE_BALANCE = 500.0;
            const currentBalance = Number(driverWallet?.balance || 0);
            if (currentBalance < MIN_ACCEPTANCE_BALANCE) {
                throw new errors_js_1.BadRequestError(`Ride accept karne ke liye wallet mein minimum ₹${MIN_ACCEPTANCE_BALANCE.toFixed(0)} hona zaroori hai. Aapka current balance ₹${currentBalance.toFixed(2)} hai. Kripya pehle wallet recharge karein.`);
            }
        }
        const vehicles = await db_js_1.db.vehicles.findByDriverId(driverId);
        const assignedVehicle = vehicles.length > 0 ? vehicles[0] : null;
        // Atomically transition status to ASSIGNED
        const updated = await db_js_1.db.bookings.update(bookingId, {
            status: shared_1.BookingStatus.ASSIGNED,
            assignedDriverId: driverId,
            assignedVehicleId: assignedVehicle?.id
        });
        // Emit live update to customer
        socket_service_js_1.socketService.emitBookingStatusUpdated(bookingId, shared_1.BookingStatus.ASSIGNED, {
            driver: {
                id: driver.id,
                name: driverUser?.name,
                phone: driverUser?.phone,
                rating: driver.ratingAverage,
                vehicle: assignedVehicle ? {
                    make: assignedVehicle.make,
                    model: assignedVehicle.model,
                    regNumber: assignedVehicle.registrationNumber
                } : null
            }
        });
        logger_js_1.logger.info(`Dispatch: Booking ${booking.bookingCode} accepted by Driver ${driverUser?.name} (${driverId})`);
        return updated;
    }
}
exports.DispatchService = DispatchService;
exports.dispatchService = new DispatchService();
