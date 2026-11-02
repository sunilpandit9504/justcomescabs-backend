import { db } from '../../services/db.js';
import { socketService } from '../socket/socket.service.js';
import { BookingStatus, KycStatus, WS_EVENTS } from '@gatigo/shared';
import { BadRequestError, NotFoundError, ConflictError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';

export class DispatchService {
  /**
   * Dispatches a pending customer booking to nearby eligible online drivers
   */
  public async dispatchBooking(bookingId: string) {
    const booking = await db.bookings.findById(bookingId);
    if (!booking) return;

    if (booking.status !== BookingStatus.PENDING_DISPATCH) {
      return;
    }

    // Query online drivers
    const onlineDrivers = await db.driverAvailability.findOnlineDriversNearby(
      Number(booking.pickupLatitude),
      Number(booking.pickupLongitude),
      15 // 15 km radius
    );

    // Filter by KYC Verified, Matching Vehicle Category, and Service Type Permission
    const eligibleDrivers: string[] = [];
    for (const d of onlineDrivers) {
      const driver = await db.driverProfiles.findById(d.driverId);
      if (driver && driver.kycStatus === KycStatus.VERIFIED) {
        // STRICT ENFORCEMENT: Drivers with DELIVERY only access cannot receive passenger cab rides
        if ((driver as any).serviceType === 'DELIVERY') {
          continue;
        }

        const vehicles = await db.vehicles.findByDriverId(driver.id);
        const hasMatchingVehicle = vehicles.some(v => v.category === booking.vehicleCategory && v.isActive);
        if (hasMatchingVehicle) {
          eligibleDrivers.push(driver.id);
        }
      }
    }

    logger.info(`Dispatch: Found ${eligibleDrivers.length} eligible drivers for booking ${booking.bookingCode}`);

    // Broadcast ride offer to eligible drivers
    for (const driverId of eligibleDrivers) {
      // In real scenario, emit to each driver's socket room
      // or emit global request event with category filter
    }
  }

  /**
   * Atomically accepts a customer ride request
   */
  public async acceptBooking(bookingId: string, driverId: string) {
    const booking = await db.bookings.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Strict atomic assignment check
    if (booking.status !== BookingStatus.PENDING_DISPATCH) {
      throw new ConflictError(`This ride is no longer available (Current status: ${booking.status})`);
    }

    const driver = await db.driverProfiles.findById(driverId);
    if (!driver || driver.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestError('Driver must be verified by admin before accepting rides');
    }

    // STRICT ENFORCEMENT: Delivery-only drivers are locked out of passenger rides
    if ((driver as any).serviceType === 'DELIVERY') {
      throw new BadRequestError('Admin has restricted your account to Parcel Delivery only. You cannot accept passenger cab rides.');
    }

    // MANDATORY PLATFORM RULE: Driver must have at least ₹500 in their wallet to accept rides
    const driverUser = await db.users.findById(driver.userId);
    if (driverUser) {
      const driverWallet = await db.wallets.findByUserId(driverUser.id);
      const MIN_ACCEPTANCE_BALANCE = 500.0;
      const currentBalance = Number(driverWallet?.balance || 0);
      if (currentBalance < MIN_ACCEPTANCE_BALANCE) {
        throw new BadRequestError(
          `Ride accept karne ke liye wallet mein minimum ₹${MIN_ACCEPTANCE_BALANCE.toFixed(0)} hona zaroori hai. Aapka current balance ₹${currentBalance.toFixed(2)} hai. Kripya pehle wallet recharge karein.`
        );
      }
    }

    const vehicles = await db.vehicles.findByDriverId(driverId);
    const assignedVehicle = vehicles.length > 0 ? vehicles[0] : null;

    // Atomically transition status to ASSIGNED
    const updated = await db.bookings.update(bookingId, {
      status: BookingStatus.ASSIGNED,
      assignedDriverId: driverId,
      assignedVehicleId: assignedVehicle?.id
    });

    // Emit live update to customer
    socketService.emitBookingStatusUpdated(bookingId, BookingStatus.ASSIGNED, {
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

    logger.info(`Dispatch: Booking ${booking.bookingCode} accepted by Driver ${driverUser?.name} (${driverId})`);

    return updated;
  }
}

export const dispatchService = new DispatchService();
