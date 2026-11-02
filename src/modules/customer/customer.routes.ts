import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { db } from '../../services/db.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';

const router = Router();

// Get customer profile
router.get('/profile', authenticateToken, requireRoles(UserRole.CUSTOMER, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.users.findById(req.user!.id);
    const profile = await db.customerProfiles.findByUserId(req.user!.id);
    const addresses = profile ? await db.savedAddresses.findByCustomerId(profile.id) : [];

    res.json({
      success: true,
      data: {
        user,
        profile,
        savedAddresses: addresses
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update customer profile
router.put('/profile', authenticateToken, requireRoles(UserRole.CUSTOMER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, emergencyContactName, emergencyContactPhone, preferredLanguage } = req.body;
    
    if (name || preferredLanguage) {
      await db.users.update(req.user!.id, {
        ...(name ? { name } : {}),
        ...(preferredLanguage ? { preferredLanguage } : {})
      });
    }

    if (req.user!.customerId && (emergencyContactName || emergencyContactPhone)) {
      await db.customerProfiles.update(req.user!.customerId, {
        emergencyContactName,
        emergencyContactPhone
      });
    }

    const updatedUser = await db.users.findById(req.user!.id);
    const updatedProfile = req.user!.customerId ? await db.customerProfiles.findById(req.user!.customerId) : null;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser, profile: updatedProfile }
    });
  } catch (err) {
    next(err);
  }
});

// Saved addresses
router.get('/saved-addresses', authenticateToken, requireRoles(UserRole.CUSTOMER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.customerId) {
      return res.json({ success: true, data: [] });
    }
    const addresses = await db.savedAddresses.findByCustomerId(req.user!.customerId);
    res.json({ success: true, data: addresses });
  } catch (err) {
    next(err);
  }
});

router.post('/saved-addresses', authenticateToken, requireRoles(UserRole.CUSTOMER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, address, latitude, longitude } = req.body;
    if (!label || !address || latitude === undefined || longitude === undefined) {
      throw new BadRequestError('Label, address, latitude, and longitude are required');
    }

    if (!req.user!.customerId) {
      throw new BadRequestError('Customer profile not initialized');
    }

    const saved = await db.savedAddresses.create({
      customerId: req.user!.customerId,
      label,
      address,
      latitude,
      longitude
    });

    res.status(201).json({
      success: true,
      message: 'Address saved successfully',
      data: saved
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-addresses/:id', authenticateToken, requireRoles(UserRole.CUSTOMER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.savedAddresses.delete(req.params.id);
    res.json({ success: true, message: 'Address removed successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
