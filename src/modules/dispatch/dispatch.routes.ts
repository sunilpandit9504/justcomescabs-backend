import { Router, Request, Response, NextFunction } from 'express';
import { dispatchService } from './dispatch.service.js';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';

const router = Router();

// Driver accepts booking
router.post('/bookings/:id/accept', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.driverId) {
      throw new BadRequestError('Driver profile not linked to user');
    }

    const updated = await dispatchService.acceptBooking(req.params.id, req.user!.driverId);

    res.json({
      success: true,
      message: 'Ride successfully accepted and assigned to you',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
