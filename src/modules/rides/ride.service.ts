import { db } from '../../services/db.js';
import { socketService } from '../socket/socket.service.js';
import { financeService } from '../finance/finance.service.js';
import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  WalletTransactionType
} from '@gatigo/shared';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface CompleteRideInput {
  bookingId: string;
  driverId: string;
  actualDistanceKm?: number;
  tollCharges?: number;
  parkingCharges?: number;
}

export class RideService {
  /**
   * Driver marks that they are en route to the customer pickup
   */
  public async markDriverArriving(bookingId: string, driverId: string) {
    const booking = await this.validateAssignedDriver(bookingId, driverId);

    if (booking.status !== BookingStatus.ASSIGNED) {
      throw new BadRequestError(`Cannot mark arriving from status ${booking.status}`);
    }

    const updated = await db.bookings.update(bookingId, {
      status: BookingStatus.DRIVER_ARRIVING
    });

    socketService.emitBookingStatusUpdated(bookingId, BookingStatus.DRIVER_ARRIVING);
    return updated;
  }

  /**
   * Driver arrives at passenger pickup location
   */
  public async markArrivedAtPickup(bookingId: string, driverId: string) {
    const booking = await this.validateAssignedDriver(bookingId, driverId);

    if (booking.status !== BookingStatus.ASSIGNED && booking.status !== BookingStatus.DRIVER_ARRIVING) {
      throw new BadRequestError(`Cannot mark arrived from status ${booking.status}`);
    }

    const updated = await db.bookings.update(bookingId, {
      status: BookingStatus.ARRIVED_AT_PICKUP
    });

    socketService.emitBookingStatusUpdated(bookingId, BookingStatus.ARRIVED_AT_PICKUP);
    return updated;
  }

  /**
   * Driver verifies passenger with 4-digit Ride OTP and starts trip
   */
  public async startRide(bookingId: string, driverId: string, otp: string) {
    const booking = await this.validateAssignedDriver(bookingId, driverId);

    if (booking.status !== BookingStatus.ARRIVED_AT_PICKUP && booking.status !== BookingStatus.DRIVER_ARRIVING && booking.status !== BookingStatus.ASSIGNED) {
      throw new BadRequestError(`Cannot start trip from status ${booking.status}`);
    }

    // Verify Passenger OTP
    if (!otp || booking.rideOtp !== otp.trim()) {
      throw new BadRequestError('Invalid ride OTP. Please ask the passenger for the 4-digit code shown in their app.');
    }

    const updated = await db.bookings.update(bookingId, {
      status: BookingStatus.IN_PROGRESS,
      startTime: new Date()
    });

    socketService.emitBookingStatusUpdated(bookingId, BookingStatus.IN_PROGRESS, {
      startTime: updated?.startTime
    });

    logger.info(`Ride started: ${booking.bookingCode} by Driver ${driverId}`);
    return updated;
  }

  /**
   * Driver completes trip, finalizes fare, reconciles payment, and credits driver wallet
   */
  public async completeRide(input: CompleteRideInput) {
    const { bookingId, driverId, actualDistanceKm, tollCharges = 0, parkingCharges = 0 } = input;
    const booking = await this.validateAssignedDriver(bookingId, driverId);

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestError(`Cannot complete a ride that is not in progress (Current: ${booking.status})`);
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
    const updated = await db.bookings.update(bookingId, {
      status: BookingStatus.COMPLETED,
      endTime: now,
      actualDistanceKm: finalDistance,
      actualDurationMinutes: durationMins,
      finalFare,
      paymentStatus: PaymentStatus.PAID
    });

    // Credit Driver Wallet (Double-entry ledger entry)
    const driver = await db.driverProfiles.findById(driverId);
    if (driver) {
      const driverUser = await db.users.findById(driver.userId);
      if (driverUser) {
        const wallet = await db.wallets.findByUserId(driverUser.id);
        const { balanceBefore, balanceAfter } = await db.wallets.updateBalance(wallet.id, driverEarnings, 'CREDIT');

        await db.walletTransactions.create({
          walletId: wallet.id,
          idempotencyKey: `TRIP_PAYOUT_${bookingId}_${Date.now()}`,
          referenceBookingId: bookingId,
          type: WalletTransactionType.TRIP_EARNING,
          direction: 'CREDIT',
          amount: driverEarnings,
          balanceBefore,
          balanceAfter,
          status: 'SETTLED',
          description: `Earnings for completed trip ${booking.bookingCode} (Gross: ₹${finalFare}, Platform fee: ₹${platformFee})`,
          metadata: { grossFare: finalFare, platformFee, driverEarnings, tollCharges, parkingCharges }
        });

        // Update driver completed trip counter
        await db.driverProfiles.update(driver.id, {
          totalCompletedTrips: (driver.totalCompletedTrips || 0) + 1
        });
      }
    }

    // Update customer completed trip counter
    if (booking.customerId) {
      const customer = await db.customerProfiles.findById(booking.customerId);
      if (customer) {
        await db.customerProfiles.update(customer.id, {
          totalTrips: (customer.totalTrips || 0) + 1
        });
      }
    }

    // Settle peer driver commission if this was an offline shared booking
    await financeService.settleSharedBookingCommission(bookingId);

    socketService.emitBookingStatusUpdated(bookingId, BookingStatus.COMPLETED, {
      finalFare,
      actualDistanceKm: finalDistance,
      driverEarnings,
      completedAt: now
    });

    logger.info(`Ride completed: ${booking.bookingCode}. Final Fare: ₹${finalFare}, Driver Net: ₹${driverEarnings}`);

    return {
      booking: updated,
      finalFare,
      driverEarnings,
      platformFee
    };
  }

  private async validateAssignedDriver(bookingId: string, driverId: string) {
    const booking = await db.bookings.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (booking.assignedDriverId !== driverId) {
      throw new ForbiddenError('Only the assigned driver can update this ride status');
    }
    return booking;
  }
}

export const rideService = new RideService();
