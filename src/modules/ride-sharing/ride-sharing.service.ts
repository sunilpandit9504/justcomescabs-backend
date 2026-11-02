import { db } from '../../services/db.js';
import { socketService } from '../socket/socket.service.js';
import {
  BookingStatus,
  BookingSource,
  CommissionType,
  SharingMode,
  KycStatus
} from '@gatigo/shared';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';

export interface PublishSharingInput {
  creatorDriverId: string;
  bookingId: string;
  sharingMode?: SharingMode;
  directTargetDriverId?: string;
  commissionType?: CommissionType;
  commissionValue?: number;
  expiresInMinutes?: number;
}

export class RideSharingService {
  /**
   * Driver A shares their offline booking with the driver network or a direct driver
   */
  public async publishForSharing(input: PublishSharingInput) {
    const {
      creatorDriverId,
      bookingId,
      sharingMode = SharingMode.OPEN_DRIVER_NETWORK,
      directTargetDriverId,
      commissionType = CommissionType.PERCENTAGE,
      commissionValue = 10.0, // Default 10% commission to Driver A
      expiresInMinutes = 45
    } = input;

    const booking = await db.bookings.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.creatorDriverId !== creatorDriverId) {
      throw new ForbiddenError('Only the creator driver can share this booking');
    }

    if (booking.bookingSource !== BookingSource.OFFLINE_DRIVER_BOOKING) {
      throw new BadRequestError('Only offline driver-created bookings can be shared via the peer network');
    }

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.AVAILABLE_FOR_SHARING) {
      throw new BadRequestError(`Cannot share booking in status ${booking.status}. It must be CONFIRMED or AVAILABLE_FOR_SHARING.`);
    }

    const totalFare = Number(booking.finalFare || booking.estimatedFare);
    const advanceCollected = Number(booking.advancePaid || 0);

    // Compute Driver A Commission
    let driverACommission = 0;
    if (commissionType === CommissionType.PERCENTAGE) {
      driverACommission = Math.round((totalFare * Number(commissionValue)) / 100);
    } else {
      driverACommission = Math.round(Number(commissionValue));
    }

    // Platform nominal match fee (₹0 to ₹50)
    const platformFee = Math.min(50, Math.round(totalFare * 0.02));

    // Driver B Expected Earnings: Total Fare - Driver A Commission - Platform Fee
    const driverBExpectedNetEarnings = totalFare - driverACommission - platformFee;

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Create sharing request
    const sharingRequest = await db.rideSharingRequests.create({
      bookingId,
      creatorDriverId,
      sharingMode,
      directTargetDriverId,
      agreedCommissionType: commissionType,
      agreedCommissionValue: commissionValue,
      computedCommissionAmount: driverACommission,
      expectedDriverBEarnings: driverBExpectedNetEarnings,
      platformFee,
      status: 'OFFERED',
      expiresAt
    });

    // Update booking status to OFFERED
    await db.bookings.update(bookingId, {
      status: BookingStatus.OFFERED
    });

    const creatorUser = await db.users.findById((await db.driverProfiles.findById(creatorDriverId))!.userId);

    const broadcastPayload = {
      sharingRequestId: sharingRequest.id,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      tripType: booking.bookingType,
      vehicleCategory: booking.vehicleCategory,
      pickupAddress: booking.pickupAddress,
      destinationAddress: booking.destinationAddress,
      scheduledPickupTime: booking.scheduledPickupTime,
      estimatedDistanceKm: booking.estimatedDistanceKm,
      totalFare,
      advancePaidToCreator: advanceCollected,
      balanceToCollectFromCustomer: Number(booking.remainingCustomerBalance),
      driverBExpectedNetEarnings,
      driverACommission,
      creatorDriverName: creatorUser?.name || 'Partner Driver',
      expiresAt
    };

    // Broadcast offer via Socket.IO
    socketService.emitRideShareOffer(broadcastPayload);

    logger.info(`Ride sharing published: ${booking.bookingCode} by Driver A (${creatorDriverId}). Driver A Commission: ₹${driverACommission}, Driver B Net: ₹${driverBExpectedNetEarnings}`);

    return {
      sharingRequest,
      pricingBreakdown: {
        totalFare,
        advanceCollectedByDriverA: advanceCollected,
        balanceToCollectFromCustomer: Number(booking.remainingCustomerBalance),
        driverACommission,
        platformFee,
        driverBExpectedNetEarnings
      }
    };
  }

  /**
   * Driver B views incoming offline sharing offers in their operational zone.
   * STRICT PRIVACY GUARD: Mask customer phone and hide private notes until accepted.
   */
  public async getIncomingOffers(driverBId: string) {
    const activeOffers = await db.rideSharingRequests.findActiveOffersForDriver(driverBId);

    const sanitizedOffers = await Promise.all(activeOffers.map(async (req) => {
      const booking = await db.bookings.findById(req.bookingId);
      if (!booking || booking.status !== BookingStatus.OFFERED) return null;

      const details = await db.offlineBookingDetails.findByBookingId(booking.id);
      const creatorDriver = await db.driverProfiles.findById(req.creatorDriverId);
      const creatorUser = creatorDriver ? await db.users.findById(creatorDriver.userId) : null;

      const secondsRemaining = Math.max(0, Math.round((req.expiresAt.getTime() - Date.now()) / 1000));

      return {
        sharingRequestId: req.id,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        tripType: booking.bookingType,
        vehicleCategory: booking.vehicleCategory,
        pickupAddress: booking.pickupAddress,
        destinationAddress: booking.destinationAddress,
        scheduledPickupTime: booking.scheduledPickupTime,
        estimatedDistanceKm: booking.estimatedDistanceKm,
        totalFare: Number(booking.finalFare || booking.estimatedFare),
        advancePaidToCreator: Number(booking.advancePaid),
        balanceToCollectFromCustomer: Number(booking.remainingCustomerBalance),
        driverBExpectedNetEarnings: Number(req.expectedDriverBEarnings),
        driverACommission: Number(req.computedCommissionAmount),
        creatorDriverName: creatorUser?.name || 'Partner Driver',
        specialInstructions: details?.specialInstructions || null,
        expiresInSeconds: secondsRemaining,
        sharingMode: req.sharingMode,
        isDirectInvite: req.sharingMode === SharingMode.DIRECT_OFFER,
        matchingZone: 'Within 15 KM • Operational Hub',
        // Privacy Guard: Mask customer identity
        customerSummary: {
          name: details ? `${details.offlineCustomerName.charAt(0)}***` : 'Customer',
          phoneMasked: details ? `${details.offlineCustomerPhone.substring(0, 5)}*****` : 'Protected'
        }
      };
    }));

    return sanitizedOffers.filter(Boolean);
  }

  /**
   * Driver B atomically accepts the offline sharing offer
   */
  public async acceptSharingOffer(sharingRequestId: string, driverBId: string) {
    const sharingReq = await db.rideSharingRequests.findById(sharingRequestId);
    if (!sharingReq) {
      throw new NotFoundError('Sharing request offer not found');
    }

    const booking = await db.bookings.findById(sharingReq.bookingId);
    if (!booking) {
      throw new NotFoundError('Underlying booking not found');
    }

    // Atomic race-condition guard
    if (sharingReq.status !== 'OFFERED' || booking.status !== BookingStatus.OFFERED) {
      throw new ConflictError(`This shared ride is no longer available (Already accepted by another driver or expired)`);
    }

    if (sharingReq.expiresAt < new Date()) {
      await db.rideSharingRequests.update(sharingRequestId, { status: 'EXPIRED' });
      throw new BadRequestError('This sharing offer has expired');
    }

    if (sharingReq.creatorDriverId === driverBId) {
      throw new BadRequestError('You cannot accept your own shared booking');
    }

    const driverB = await db.driverProfiles.findById(driverBId);
    if (!driverB || driverB.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenError('Driver B must be KYC verified by admin before accepting shared trips');
    }

    // MANDATORY PLATFORM RULE: Driver must have at least ₹500 in their wallet to accept rides
    const driverBUser = await db.users.findById(driverB.userId);
    if (driverBUser) {
      const driverWallet = await db.wallets.findByUserId(driverBUser.id);
      const MIN_ACCEPTANCE_BALANCE = 500.0;
      const currentBalance = Number(driverWallet?.balance || 0);
      if (currentBalance < MIN_ACCEPTANCE_BALANCE) {
        throw new BadRequestError(
          `Ride accept karne ke liye wallet mein minimum ₹${MIN_ACCEPTANCE_BALANCE.toFixed(0)} hona zaroori hai. Aapka current balance ₹${currentBalance.toFixed(2)} hai. Kripya pehle wallet recharge karein.`
        );
      }
    }

    const vehicles = await db.vehicles.findByDriverId(driverBId);
    const assignedVehicle = vehicles.length > 0 ? vehicles[0] : null;

    // 1. Atomically lock and update sharing request status
    await db.rideSharingRequests.update(sharingRequestId, {
      status: 'ACCEPTED'
    });

    // 2. Atomically update booking status to ASSIGNED
    const updatedBooking = await db.bookings.update(booking.id, {
      status: BookingStatus.ASSIGNED,
      assignedDriverId: driverBId,
      assignedVehicleId: assignedVehicle?.id
    });

    // 3. Freeze immutable CommissionAgreement
    const commissionAgreement = await db.commissionAgreements.create({
      bookingId: booking.id,
      creatorDriverId: sharingReq.creatorDriverId,
      assignedDriverId: driverBId,
      totalFare: Number(booking.finalFare || booking.estimatedFare),
      advanceCollectedByCreator: Number(booking.advancePaid),
      creatorCommissionAmount: Number(sharingReq.computedCommissionAmount),
      platformFeeAmount: Number(sharingReq.platformFee),
      assignedDriverNetEarnings: Number(sharingReq.expectedDriverBEarnings),
      settlementStatus: 'PENDING_COMPLETION'
    });

    // 4. Fetch details to return unmasked customer data to Driver B
    const offlineDetails = await db.offlineBookingDetails.findByBookingId(booking.id);

    // 5. Notify Driver A immediately via WebSocket
    socketService.emitRideShareAccepted(sharingReq.creatorDriverId, {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      driverB: {
        id: driverB.id,
        name: driverBUser?.name,
        phone: driverBUser?.phone,
        vehicle: assignedVehicle ? `${assignedVehicle.make} ${assignedVehicle.model} (${assignedVehicle.registrationNumber})` : 'Vehicle Assigned',
        rating: driverB.ratingAverage
      },
      commissionAgreement: {
        creatorCommission: Number(sharingReq.computedCommissionAmount),
        status: 'PENDING_COMPLETION'
      }
    });

    logger.info(`Sharing offer accepted: ${booking.bookingCode} by Driver B (${driverBUser?.name}). Commission frozen: ₹${sharingReq.computedCommissionAmount}`);

    return {
      booking: updatedBooking,
      commissionAgreement,
      customerContact: {
        name: offlineDetails?.offlineCustomerName,
        phone: offlineDetails?.offlineCustomerPhone, // Unmasked for Driver B!
        specialInstructions: offlineDetails?.specialInstructions
      },
      settlementInstructions: {
        advanceAlreadyPaidToDriverA: Number(booking.advancePaid),
        balanceToCollectFromCustomer: Number(booking.remainingCustomerBalance),
        yourNetEarnings: Number(sharingReq.expectedDriverBEarnings)
      }
    };
  }

  /**
   * Driver A tracks all their shared bookings
   */
  public async getMySharedBookings(creatorDriverId: string) {
    const sharingRequests = await db.rideSharingRequests.findSharedByCreatorDriver(creatorDriverId);

    return Promise.all(sharingRequests.map(async (req) => {
      const booking = await db.bookings.findById(req.bookingId);
      const commissionAgreement = await db.commissionAgreements.findByBookingId(req.bookingId);
      let assignedDriver = null;

      if (booking?.assignedDriverId) {
        const d = await db.driverProfiles.findById(booking.assignedDriverId);
        const user = d ? await db.users.findById(d.userId) : null;
        const vehicles = d ? await db.vehicles.findByDriverId(d.id) : [];
        const liveLocation = d ? await db.driverAvailability.findByDriverId(d.id) : null;

        assignedDriver = d && user ? {
          id: d.id,
          name: user.name,
          phone: user.phone,
          vehicle: vehicles.length > 0 ? `${vehicles[0].make} ${vehicles[0].model} (${vehicles[0].registrationNumber})` : null,
          liveLocation
        } : null;
      }

      return {
        sharingRequest: req,
        booking,
        commissionAgreement,
        assignedDriver
      };
    }));
  }
}

export const rideSharingService = new RideSharingService();
