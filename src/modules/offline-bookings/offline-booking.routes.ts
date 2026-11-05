import { Router, Request, Response, NextFunction } from 'express';
import { offlineBookingService } from './offline-booking.service.js';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';
import { db } from '../../services/db.js';

const router = Router();

// Create offline booking
router.post('/', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      customerName,
      customerPhone,
      channelSource,
      tripType,
      vehicleCategory,
      pickup,
      destination,
      scheduledPickupTime,
      agreedTotalFare,
      advancePaid,
      specialInstructions,
      customerNotes,
      luggageCount,
      returnDateTime,
      advancePaymentMethod
    } = req.body;

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

    const result = await offlineBookingService.createOfflineBooking({
      creatorDriverId: driverId,
      customerName,
      customerPhone,
      channelSource,
      tripType,
      vehicleCategory,
      pickup,
      destination,
      scheduledPickupTime: scheduledPickupTime ? new Date(scheduledPickupTime) : new Date(),
      agreedTotalFare: Number(agreedTotalFare),
      advancePaid: advancePaid ? Number(advancePaid) : 0,
      specialInstructions,
      customerNotes,
      luggageCount: luggageCount ? Number(luggageCount) : 1,
      returnDateTime,
      advancePaymentMethod
    });

    res.status(201).json({
      success: true,
      message: 'Offline booking created successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

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
    const allDrivers = await db.driverProfiles.listAll();
    if (allDrivers.length > 0) driverId = allDrivers[allDrivers.length - 1].id;
  }
  if (!driverId) {
    throw new BadRequestError('Driver profile not linked to user');
  }
  return driverId;
}

// List driver's offline bookings
router.get('/', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = await resolveDriverId(req);
    const bookings = await offlineBookingService.getMyOfflineBookings(driverId);
    res.json({
      success: true,
      data: bookings
    });
  } catch (err) {
    next(err);
  }
});

// View single offline booking details
router.get('/:id', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = await resolveDriverId(req);
    const details = await offlineBookingService.getOfflineBookingById(req.params.id, driverId);
    res.json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
});

export default router;
