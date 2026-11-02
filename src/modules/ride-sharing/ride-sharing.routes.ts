import { Router, Request, Response, NextFunction } from 'express';
import { rideSharingService } from './ride-sharing.service.js';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';

import { trackingService } from './tracking.service.js';

const router = Router();

// Driver A tracks Driver B's authorized live location, timeline & commission
router.get('/:bookingId/live-tracking', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trackingData = await trackingService.getDriverALiveTracking(req.params.bookingId, req.user!.driverId!);
    res.json({
      success: true,
      data: trackingData
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

    const result = await rideSharingService.publishForSharing({
      creatorDriverId: req.user!.driverId!,
      bookingId,
      sharingMode,
      directTargetDriverId,
      commissionType,
      commissionValue: commissionValue ? Number(commissionValue) : undefined,
      expiresInMinutes: expiresInMinutes ? Number(expiresInMinutes) : undefined
    });

    res.status(200).json({
      success: true,
      message: 'Offline booking published for peer driver sharing',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// Driver B browses incoming sharing offers
router.get('/incoming-offers', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const offers = await rideSharingService.getIncomingOffers(req.user!.driverId!);
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

    const result = await rideSharingService.acceptSharingOffer(sharingRequestId, req.user!.driverId!);

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
    const sharedBookings = await rideSharingService.getMySharedBookings(req.user!.driverId!);
    res.json({
      success: true,
      data: sharedBookings
    });
  } catch (err) {
    next(err);
  }
});

export default router;
