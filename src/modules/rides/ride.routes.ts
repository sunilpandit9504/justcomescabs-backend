import { Router, Request, Response, NextFunction } from 'express';
import { rideService } from './ride.service.js';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';

const router = Router();

// Driver is en route to pickup
router.post('/:id/arriving', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await rideService.markDriverArriving(req.params.id, req.user!.driverId!);
    res.json({
      success: true,
      message: 'Status updated: Driver arriving',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Driver arrived at pickup
router.post('/:id/arrived', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await rideService.markArrivedAtPickup(req.params.id, req.user!.driverId!);
    res.json({
      success: true,
      message: 'Status updated: Arrived at pickup',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Driver starts ride with 4-digit OTP
router.post('/:id/start', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      throw new BadRequestError('Passenger ride OTP is required');
    }

    const updated = await rideService.startRide(req.params.id, req.user!.driverId!, String(otp));

    res.json({
      success: true,
      message: 'Passenger OTP verified. Trip started successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Driver completes ride
router.post('/:id/complete', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actualDistanceKm, tollCharges, parkingCharges } = req.body;

    const result = await rideService.completeRide({
      bookingId: req.params.id,
      driverId: req.user!.driverId!,
      actualDistanceKm: actualDistanceKm ? Number(actualDistanceKm) : undefined,
      tollCharges: tollCharges ? Number(tollCharges) : 0,
      parkingCharges: parkingCharges ? Number(parkingCharges) : 0
    });

    res.json({
      success: true,
      message: 'Trip completed successfully. Earnings credited to your wallet.',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
