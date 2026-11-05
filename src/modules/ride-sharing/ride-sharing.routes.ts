import { Router, Request, Response, NextFunction } from 'express';
import { rideSharingService } from './ride-sharing.service.js';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';

import { trackingService } from './tracking.service.js';

const router = Router();

import { db } from '../../services/db.js';

async function resolveDriverId(req: Request): Promise<string> {
  let driverId = req.user?.driverId;
  if (!driverId && req.user?.id) {
    const driver = await db.driverProfiles.findByUserId(req.user.id);
    driverId = driver?.id;
  }
  if (!driverId && req.user?.phone) {
    const u = await db.users.findByPhone(req.user.phone);
    if (u) {
      const d = await db.driverProfiles.findByUserId(u.id);
      driverId = d?.id;
    }
  }
  if (!driverId) {
    throw new BadRequestError('Driver profile not linked to user');
  }
  return driverId;
}

// Driver A tracks Driver B's authorized live location, timeline & commission
router.get('/:bookingId/live-tracking', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = await resolveDriverId(req);
    const trackingData = await trackingService.getDriverALiveTracking(req.params.bookingId, driverId);
    res.json({
      success: true,
      data: trackingData
    });
  } catch (err) {
    next(err);
  }
});

// Search registered drivers for direct friend sharing
router.get('/search-drivers', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerDriverId = await resolveDriverId(req);
    const query = String(req.query.q || req.query.query || '').trim().toLowerCase();

    const allDrivers = await db.driverProfiles.listAll();
    const results = [];

    for (const driver of allDrivers) {
      if (driver.id === callerDriverId) continue; // Exclude caller driver

      const user = await db.users.findById(driver.userId);
      if (!user) continue;

      const name = user.name || 'Driver Partner';
      const phone = user.phone || '';
      const city = driver.serviceCity || 'Ranchi, JH';

      if (query) {
        const matches = name.toLowerCase().includes(query) ||
                        phone.toLowerCase().includes(query) ||
                        city.toLowerCase().includes(query);
        if (!matches) continue;
      }

      const vehicles = await db.vehicles.findByDriverId(driver.id);
      const vehicleDesc = vehicles[0]
        ? `${vehicles[0].category || 'Cab'} • ${vehicles[0].model || 'Vehicle'} (${vehicles[0].registrationNumber || ''})`.trim()
        : 'Sedan / Cab';
      const availability = await db.driverAvailability.findByDriverId(driver.id);

      results.push({
        id: driver.id,
        driverId: driver.id,
        name,
        phone,
        formatted: `${name} ( ${phone} )`,
        city,
        vehicle: vehicleDesc,
        rating: `${((driver as any).rating || 4.9).toFixed(1)} ★`,
        isOnline: availability ? availability.isOnline : true,
        kycStatus: driver.kycStatus
      });
    }

    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    next(err);
  }
});

// Driver A publishes offline booking to sharing pool
router.post('/publish', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, sharingMode, directTargetDriverId, commissionType, commissionValue, expiresInMinutes } = req.body;

    if (!bookingId) {
      throw new BadRequestError('bookingId is required');
    }

    const driverId = await resolveDriverId(req);

    // Normalize sharing mode
    const mode = (sharingMode === 'DIRECT_DRIVER' || sharingMode === 'DIRECT_OFFER')
      ? 'DIRECT_OFFER'
      : 'OPEN_DRIVER_NETWORK';

    // Resolve direct target driver ID cleanly if provided
    let targetDriverId = directTargetDriverId;
    if (targetDriverId) {
      const cleanTarget = String(targetDriverId).trim();
      // 1. Direct match by ID
      const directMatch = await db.driverProfiles.findById(cleanTarget);
      if (directMatch) {
        targetDriverId = directMatch.id;
      } else {
        // 2. Extract 10-digit phone number if phone or formatted string passed
        const digits = cleanTarget.replace(/\D/g, '');
        if (digits.length >= 10) {
          const tenDigit = digits.slice(-10);
          const u = await db.users.findByPhone(`+91${tenDigit}`) || await db.users.findByPhone(tenDigit);
          if (u) {
            const d = await db.driverProfiles.findByUserId(u.id);
            if (d) targetDriverId = d.id;
          }
        }
      }
    }

    const result = await rideSharingService.publishForSharing({
      creatorDriverId: driverId,
      bookingId,
      sharingMode: mode as any,
      directTargetDriverId: targetDriverId,
      commissionType,
      commissionValue: commissionValue ? Number(commissionValue) : undefined,
      expiresInMinutes: expiresInMinutes ? Number(expiresInMinutes) : undefined
    });

    res.status(200).json({
      success: true,
      message: mode === 'DIRECT_OFFER'
        ? 'Offline booking dispatched directly to friend driver'
        : 'Offline booking published for peer driver sharing',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// Driver B browses incoming sharing offers
router.get('/incoming-offers', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = await resolveDriverId(req);
    const offers = await rideSharingService.getIncomingOffers(driverId);
    res.json({
      success: true,
      data: offers
    });
  } catch (err) {
    next(err);
  }
});

// Driver B accepts sharing offer
router.post('/accept', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sharingRequestId } = req.body;
    if (!sharingRequestId) {
      throw new BadRequestError('sharingRequestId is required');
    }

    const driverId = await resolveDriverId(req);
    const result = await rideSharingService.acceptSharingOffer(sharingRequestId, driverId);

    res.status(200).json({
      success: true,
      message: 'Shared ride successfully assigned to you',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// Driver A views their shared bookings
router.get('/my-shared', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = await resolveDriverId(req);
    const sharedBookings = await rideSharingService.getMySharedBookings(driverId);
    res.json({
      success: true,
      data: sharedBookings
    });
  } catch (err) {
    next(err);
  }
});

export default router;
