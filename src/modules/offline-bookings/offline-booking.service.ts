import { db, BookingEntity, OfflineBookingDetailEntity } from '../../services/db.js';
import {
  BookingSource,
  BookingStatus,
  BookingType,
  OfflineChannelSource,
  PaymentMethod,
  PaymentStatus,
  VehicleCategory
} from '@gatigo/shared';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';
import { pricingService } from '../pricing/pricing.service.js';

export interface CreateOfflineBookingInput {
  creatorDriverId: string;
  customerName: string;
  customerPhone: string;
  channelSource?: OfflineChannelSource;
  tripType?: BookingType;
  vehicleCategory: VehicleCategory;
  pickup: {
    address: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    address: string;
    latitude: number;
    longitude: number;
  };
  scheduledPickupTime: Date;
  agreedTotalFare: number;
  advancePaid?: number;
  specialInstructions?: string;
  customerNotes?: string;
  luggageCount?: number;
  returnDateTime?: Date;
  advancePaymentMethod?: string;
}

export class OfflineBookingService {
  private generateOfflineBookingCode(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `GTG-OFF-${yearMonth}-${randomSuffix}`;
  }

  /**
   * Driver manually enters a physical customer booking received via phone, WhatsApp, etc.
   */
  public async createOfflineBooking(input: CreateOfflineBookingInput): Promise<{ booking: BookingEntity; details: OfflineBookingDetailEntity }> {
    const {
      creatorDriverId,
      customerName,
      customerPhone,
      channelSource = OfflineChannelSource.PHONE_CALL,
      tripType = BookingType.ONE_WAY,
      vehicleCategory,
      pickup,
      destination,
      scheduledPickupTime,
      agreedTotalFare,
      advancePaid = 0,
      specialInstructions,
      customerNotes,
      luggageCount = 1,
      returnDateTime,
      advancePaymentMethod = 'Direct Cash/UPI to Driver A'
    } = input;

    if (!customerName || !customerPhone) {
      throw new BadRequestError('Customer name and phone number are required');
    }
    if (!agreedTotalFare || agreedTotalFare <= 0) {
      throw new BadRequestError('Agreed total fare must be greater than zero');
    }

    const distanceKm = pricingService.calculateDistanceKm(pickup, destination);
    const durationMinutes = pricingService.estimateDurationMinutes(distanceKm, tripType === BookingType.OUTSTATION);
    const remainingBalance = Math.max(0, agreedTotalFare - advancePaid);

    const bookingCode = this.generateOfflineBookingCode();

    // 1. Create main booking record
    const booking = await db.bookings.create({
      bookingCode,
      bookingSource: BookingSource.OFFLINE_DRIVER_BOOKING,
      bookingType: tripType,
      status: BookingStatus.CONFIRMED,
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
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: advancePaid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PENDING,
      rideOtp: Math.floor(1000 + Math.random() * 9000).toString()
    });

    // 2. Create offline-specific details record
    const details = await db.offlineBookingDetails.create({
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

    logger.info(`Offline Booking created: ${booking.bookingCode} by Driver ${creatorDriverId} (Customer: ${customerName}, Fare: ₹${agreedTotalFare}, Advance: ₹${advancePaid})`);

    return { booking, details };
  }

  /**
   * Returns all offline bookings created by the given driver
   */
  public async getMyOfflineBookings(creatorDriverId: string) {
    const bookings = await db.bookings.findOfflineCreatedByDriver(creatorDriverId);
    
    return Promise.all(bookings.map(async (booking) => {
      const details = await db.offlineBookingDetails.findByBookingId(booking.id);
      const sharingRequest = await db.rideSharingRequests.findByBookingId(booking.id);
      let assignedDriver = null;
      if (booking.assignedDriverId) {
        const d = await db.driverProfiles.findById(booking.assignedDriverId);
        const user = d ? await db.users.findById(d.userId) : null;
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
  public async getOfflineBookingById(bookingId: string, driverId: string) {
    const booking = await db.bookings.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Offline booking not found');
    }

    if (booking.creatorDriverId !== driverId && booking.assignedDriverId !== driverId) {
      throw new ForbiddenError('You do not have permission to view this offline booking');
    }

    const details = await db.offlineBookingDetails.findByBookingId(bookingId);
    const sharingRequest = await db.rideSharingRequests.findByBookingId(bookingId);
    const commissionAgreement = await db.commissionAgreements.findByBookingId(bookingId);

    return {
      booking,
      offlineDetails: details,
      sharingRequest,
      commissionAgreement
    };
  }
}

export const offlineBookingService = new OfflineBookingService();
