import { db } from '../../services/db.js';
import { NotFoundError, ForbiddenError } from '../../common/errors.js';
import { BookingStatus } from '@gatigo/shared';

export class TrackingService {
  /**
   * Driver A tracks Driver B's live operations and route progress on a shared booking
   */
  public async getDriverALiveTracking(bookingId: string, requestingDriverId: string) {
    const booking = await db.bookings.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Strict Authorization: Only the creator Driver A (or assigned Driver B) can view
    if (booking.creatorDriverId !== requestingDriverId && booking.assignedDriverId !== requestingDriverId) {
      throw new ForbiddenError('You are not authorized to track this ride');
    }

    if (!booking.assignedDriverId) {
      return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        assignedDriver: null,
        liveLocation: null,
        message: 'No driver has accepted this shared booking yet'
      };
    }

    const driverB = await db.driverProfiles.findById(booking.assignedDriverId);
    const driverBUser = driverB ? await db.users.findById(driverB.userId) : null;
    const vehicles = driverB ? await db.vehicles.findByDriverId(driverB.id) : [];
    const assignedVehicle = vehicles.length > 0 ? vehicles[0] : null;

    // Get live GPS telemetry ping
    const availability = driverB ? await db.driverAvailability.findByDriverId(driverB.id) : null;
    const agreement = await db.commissionAgreements.findByBookingId(bookingId);

    // Compute status timeline
    const timeline = [
      { step: 'OFFERED', label: 'Ride Shared to Network', completed: true },
      { step: 'ASSIGNED', label: `Driver B (${driverBUser?.name}) Accepted`, completed: booking.status !== BookingStatus.OFFERED },
      { step: 'DRIVER_ARRIVING', label: 'Driver B En Route to Pickup', completed: [BookingStatus.DRIVER_ARRIVING, BookingStatus.ARRIVED_AT_PICKUP, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(booking.status) },
      { step: 'ARRIVED_AT_PICKUP', label: 'Driver B Arrived at Pickup', completed: [BookingStatus.ARRIVED_AT_PICKUP, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(booking.status) },
      { step: 'IN_PROGRESS', label: 'Passenger Boarded (Trip Started)', completed: [BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(booking.status) },
      { step: 'COMPLETED', label: 'Trip Completed & Commission Settled', completed: booking.status === BookingStatus.COMPLETED }
    ];

    return {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      tripType: booking.bookingType,
      pickup: {
        address: booking.pickupAddress,
        latitude: Number(booking.pickupLatitude),
        longitude: Number(booking.pickupLongitude)
      },
      destination: {
        address: booking.destinationAddress,
        latitude: Number(booking.destinationLatitude),
        longitude: Number(booking.destinationLongitude)
      },
      assignedDriver: driverB && driverBUser ? {
        id: driverB.id,
        name: driverBUser.name,
        phone: driverBUser.phone,
        ratingAverage: driverB.ratingAverage,
        vehicle: assignedVehicle ? {
          make: assignedVehicle.make,
          model: assignedVehicle.model,
          color: assignedVehicle.color,
          registrationNumber: assignedVehicle.registrationNumber
        } : null
      } : null,
      liveLocation: availability ? {
        latitude: Number(availability.currentLatitude),
        longitude: Number(availability.currentLongitude),
        heading: availability.heading ? Number(availability.heading) : 0,
        speedKmh: availability.speedKmh ? Number(availability.speedKmh) : 0,
        isOnline: availability.isOnline,
        lastPingAt: availability.lastPingAt
      } : null,
      commissionTracker: agreement ? {
        agreedCreatorCommission: Number(agreement.creatorCommissionAmount),
        settlementStatus: agreement.settlementStatus,
        settledAt: agreement.settledAt || null
      } : null,
      timeline
    };
  }
}

export const trackingService = new TrackingService();
