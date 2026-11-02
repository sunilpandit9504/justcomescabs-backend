import { Router, Request, Response, NextFunction } from 'express';
import { pricingService } from './pricing.service.js';
import { BadRequestError } from '../../common/errors.js';

const router = Router();

router.post('/estimate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pickup, destination, isOutstation = false } = req.body;

    if (!pickup || pickup.latitude === undefined || pickup.longitude === undefined) {
      throw new BadRequestError('Valid pickup coordinates are required');
    }
    if (!destination || destination.latitude === undefined || destination.longitude === undefined) {
      throw new BadRequestError('Valid destination coordinates are required');
    }

    const estimates = pricingService.getFareEstimates(pickup, destination, Boolean(isOutstation));

    res.json({
      success: true,
      data: estimates
    });
  } catch (err) {
    next(err);
  }
});

export default router;
