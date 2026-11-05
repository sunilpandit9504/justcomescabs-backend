import { Router, Request, Response, NextFunction } from 'express';
import { bookingService } from './booking.service.js';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';
import { db } from '../../services/db.js';

const router = Router();

// Create new customer booking
router.post('/', authenticateToken, requireRoles(UserRole.CUSTOMER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pickup, destination, vehicleCategory, bookingType, paymentMethod, scheduledPickupTime } = req.body;

    if (!pickup || !destination || !vehicleCategory) {
      throw new BadRequestError('pickup, destination, and vehicleCategory are required');
    }

    if (!req.user!.customerId) {
      throw new BadRequestError('Customer profile not initialized');
    }

    const booking = await bookingService.createCustomerBooking({
      customerId: req.user!.customerId,
      pickup,
      destination,
      vehicleCategory,
      bookingType,
      paymentMethod,
      scheduledPickupTime: scheduledPickupTime ? new Date(scheduledPickupTime) : undefined
    });

    res.status(201).json({
      success: true,
      message: 'Booking created. Dispatching to nearby drivers.',
      data: booking
    });
  } catch (err) {
    next(err);
  }
});

// List customer rides
router.get('/my-rides', authenticateToken, requireRoles(UserRole.CUSTOMER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let customerId = req.user?.customerId;
    if (!customerId && req.user?.id) {
      const profile = await db.customerProfiles.findByUserId(req.user.id);
      customerId = profile?.id;
    }
    if (!customerId && req.user?.phone) {
      const u = await db.users.findByPhone(req.user.phone);
      if (u) {
        const p = await db.customerProfiles.findByUserId(u.id);
        customerId = p?.id;
      }
    }

    if (!customerId) {
      return res.json({ success: true, data: [] });
    }

    const rides = await db.bookings.findByCustomerId(customerId);
    rides.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: rides
    });
  } catch (err) {
    next(err);
  }
});

// Get booking details
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const details = await bookingService.getBookingDetails(req.params.id);
    res.json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
});

// Cancel booking
router.post('/:id/cancel', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason = 'Cancelled by user' } = req.body;
    const cancelledBy = req.user!.role === UserRole.CUSTOMER ? 'CUSTOMER' : 'DRIVER';
    const updated = await bookingService.cancelBooking(req.params.id, req.user!.id, reason, cancelledBy);

    res.json({
      success: true,
      message: 'Booking cancelled',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Rate completed booking
router.post('/:id/rate', authenticateToken, requireRoles(UserRole.CUSTOMER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { score, comment } = req.body;
    if (score === undefined) {
      throw new BadRequestError('Score is required');
    }

    const rating = await bookingService.rateBooking(req.params.id, req.user!.customerId!, Number(score), comment);

    res.json({
      success: true,
      message: 'Trip rating submitted successfully',
      data: rating
    });
  } catch (err) {
    next(err);
  }
});

export default router;
