import { Router, Request, Response, NextFunction } from 'express';
import { offlineBookingService } from './offline-booking.service.js';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';

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

    if (!req.user!.driverId) {
      throw new BadRequestError('Driver profile not linked to user');
    }

    const result = await offlineBookingService.createOfflineBooking({
      creatorDriverId: req.user!.driverId,
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

// List driver's offline bookings
router.get('/', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.driverId) {
      return res.json({ success: true, data: [] });
    }

    const bookings = await offlineBookingService.getMyOfflineBookings(req.user!.driverId);
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
    const details = await offlineBookingService.getOfflineBookingById(req.params.id, req.user!.driverId!);
    res.json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
});

export default router;
