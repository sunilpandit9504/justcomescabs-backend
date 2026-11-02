import { db, BookingEntity } from '../../services/db.js';
import { pricingService, CoordinatesInput } from '../pricing/pricing.service.js';
import { dispatchService } from '../dispatch/dispatch.service.js';
import { socketService } from '../socket/socket.service.js';
import {
  BookingSource,
  BookingStatus,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  VehicleCategory,
  WS_EVENTS
} from '@gatigo/shared';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';

export interface CreateBookingInput {
  customerId: string;
  pickup: CoordinatesInput;
  destination: CoordinatesInput;
  vehicleCategory: VehicleCategory;
  bookingType?: BookingType;
  scheduledPickupTime?: Date;
  paymentMethod?: PaymentMethod;
}

export class BookingService {
  /**
   * Generates a unique, memorable booking code (e.g. GTG-202610-8472)
   */
  private generateBookingCode(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `GTG-${yearMonth}-${randomSuffix}`;
  }

  /**
   * Creates an online customer booking and initiates dispatch
   */
  public async createCustomerBooking(input: CreateBookingInput): Promise<BookingEntity> {
    const { customerId, pickup, destination, vehicleCategory, bookingType = BookingType.ONE_WAY, paymentMethod = PaymentMethod.CASH } = input;

    const distanceKm = pricingService.calculateDistanceKm(pickup, destination);
    const durationMinutes = pricingService.estimateDurationMinutes(distanceKm, bookingType === BookingType.OUTSTATION);
    const estimatedFare = pricingService.computeFare(vehicleCategory, distanceKm, durationMinutes);

    // Generate 4-digit ride OTP for passenger verification
    const rideOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const bookingCode = this.generateBookingCode();

    const booking = await db.bookings.create({
      bookingCode,
      bookingSource: BookingSource.CUSTOMER_APP,
      bookingType,
      status: BookingStatus.PENDING_DISPATCH,
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
      paymentStatus: PaymentStatus.PENDING,
      rideOtp
    });

    logger.info(`Customer Booking created: ${booking.bookingCode} (Fare: ₹${estimatedFare}, OTP: ${rideOtp})`);

    // Initiate dispatch to nearby online drivers asynchronously
    dispatchService.dispatchBooking(booking.id).catch((err) => {
      logger.error(`Error in dispatching booking ${booking.id}:`, err);
    });

    return booking;
  }

  /**
   * Retrieves booking details with complete driver and vehicle context
   */
  public async getBookingDetails(bookingId: string) {
    const booking = await db.bookings.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    let customer = null;
    if (booking.customerId) {
      customer = await db.customerProfiles.findById(booking.customerId);
    }

    let driver = null;
    let driverUser = null;
    let vehicle = null;
    let liveLocation = null;

    if (booking.assignedDriverId) {
      driver = await db.driverProfiles.findById(booking.assignedDriverId);
      if (driver) {
        driverUser = await db.users.findById(driver.userId);
        const vehicles = await db.vehicles.findByDriverId(driver.id);
        vehicle = vehicles.length > 0 ? vehicles[0] : null;
        liveLocation = await db.driverAvailability.findByDriverId(driver.id);
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
  public async cancelBooking(bookingId: string, actorId: string, reason: string, cancelledBy: 'CUSTOMER' | 'DRIVER' | 'ADMIN') {
    const booking = await db.bookings.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

    if (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError(`Cannot cancel a booking that is already ${booking.status}`);
    }

    const updated = await db.bookings.update(bookingId, {
      status: BookingStatus.CANCELLED,
      cancellationReason: reason,
      cancelledBy
    });

    socketService.emitBookingStatusUpdated(bookingId, BookingStatus.CANCELLED, { reason, cancelledBy });

    return updated;
  }

  /**
   * Submits passenger rating for the trip
   */
  public async rateBooking(bookingId: string, customerId: string, score: number, comment?: string) {
    if (score < 1 || score > 5) {
      throw new BadRequestError('Score must be between 1 and 5');
    }

    const booking = await db.bookings.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestError('Only completed trips can be rated');
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenError('Only the booking customer can rate this trip');
    }

    if (booking.assignedDriverId) {
      const driver = await db.driverProfiles.findById(booking.assignedDriverId);
      if (driver) {
        // Recompute weighted average rating
        const totalTrips = driver.totalCompletedTrips || 1;
        const currentAvg = Number(driver.ratingAverage);
        const newAvg = Number(((currentAvg * (totalTrips - 1) + score) / totalTrips).toFixed(2));

        await db.driverProfiles.update(driver.id, {
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

export const bookingService = new BookingService();
