import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRoles } from '../../common/middleware/auth.js';
import { UserRole, KycStatus, VehicleCategory } from '@gatigo/shared';
import { db } from '../../services/db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../common/errors.js';
import { socketService } from '../socket/socket.service.js';

const router = Router();

// Get driver profile & duty state
router.get('/profile', authenticateToken, requireRoles(UserRole.DRIVER, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.users.findById(req.user!.id);
    const driver = await db.driverProfiles.findByUserId(req.user!.id);
    if (!driver) {
      throw new NotFoundError('Driver profile not found');
    }

    const vehicles = await db.vehicles.findByDriverId(driver.id);
    const documents = await db.driverDocuments.findByDriverId(driver.id);
    const availability = await db.driverAvailability.findByDriverId(driver.id);
    const wallet = await db.wallets.findByUserId(user!.id);

    res.json({
      success: true,
      data: {
        user,
        driver,
        vehicles,
        documents,
        availability,
        wallet
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update driver profile (banking/UPI & service city)
router.put('/profile', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceCity, operatingState, bankAccountHolder, bankAccountNumber, bankIfscCode, upiId, experienceYears } = req.body;
    
    if (!req.user!.driverId) {
      throw new BadRequestError('Driver profile not found');
    }

    const updated = await db.driverProfiles.update(req.user!.driverId, {
      ...(serviceCity ? { serviceCity } : {}),
      ...(operatingState ? { operatingState } : {}),
      ...(bankAccountHolder ? { bankAccountHolder } : {}),
      ...(bankAccountNumber ? { bankAccountNumber } : {}),
      ...(bankIfscCode ? { bankIfscCode } : {}),
      ...(upiId ? { upiId } : {}),
      ...(experienceYears ? { experienceYears: parseInt(experienceYears, 10) } : {})
    });

    res.json({
      success: true,
      message: 'Driver profile updated',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Upload KYC document
router.post('/kyc/documents', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentType, fileUrl, documentNumber, expiryDate } = req.body;
    if (!documentType || !fileUrl) {
      throw new BadRequestError('documentType and fileUrl are required');
    }

    if (!req.user!.driverId) {
      throw new BadRequestError('Driver profile not linked');
    }

    const doc = await db.driverDocuments.create({
      driverId: req.user!.driverId,
      documentType,
      fileUrl,
      documentNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      verificationStatus: 'PENDING'
    });

    // If driver was in PENDING, move to UNDER_REVIEW
    await db.driverProfiles.update(req.user!.driverId, {
      kycStatus: KycStatus.UNDER_REVIEW
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded for verification',
      data: doc
    });
  } catch (err) {
    next(err);
  }
});

// Register a vehicle
router.post('/vehicles', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, registrationNumber, make, model, color, year, seatingCapacity = 4, isAc = true, rcNumber } = req.body;
    
    if (!category || !registrationNumber || !make || !model) {
      throw new BadRequestError('Category, registrationNumber, make, and model are required');
    }

    if (!req.user!.driverId) {
      throw new BadRequestError('Driver profile not linked');
    }

    const vehicle = await db.vehicles.create({
      driverId: req.user!.driverId,
      category: category as VehicleCategory,
      registrationNumber: registrationNumber.toUpperCase().trim(),
      make,
      model,
      color: color || 'White',
      year: year ? parseInt(year, 10) : 2022,
      seatingCapacity: parseInt(seatingCapacity, 10),
      isAc: Boolean(isAc),
      rcNumber,
      isVerified: false,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle registered successfully',
      data: vehicle
    });
  } catch (err) {
    next(err);
  }
});

// Toggle Online / Offline Duty
router.post('/availability/toggle', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isOnline, latitude = 23.3441, longitude = 85.3096 } = req.body;
    if (!req.user!.driverId) {
      throw new BadRequestError('Driver profile not linked');
    }

    const driver = await db.driverProfiles.findById(req.user!.driverId);
    if (!driver || driver.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenError('Driver KYC must be verified by admin before taking rides online');
    }

    const availability = await db.driverAvailability.upsert(req.user!.driverId, {
      isOnline: Boolean(isOnline),
      currentLatitude: Number(latitude),
      currentLongitude: Number(longitude)
    });

    // Broadcast online status to socket room
    socketService.notifyDriverDutyStatus(req.user!.driverId, Boolean(isOnline));

    res.json({
      success: true,
      message: `Driver is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`,
      data: availability
    });
  } catch (err) {
    next(err);
  }
});

// Driver GPS location ping
router.post('/location/ping', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude, heading, speedKmh } = req.body;
    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestError('Latitude and longitude are required');
    }

    const driverId = req.user!.driverId!;
    const updated = await db.driverAvailability.upsert(driverId, {
      currentLatitude: Number(latitude),
      currentLongitude: Number(longitude),
      heading: heading !== undefined ? Number(heading) : undefined,
      speedKmh: speedKmh !== undefined ? Number(speedKmh) : undefined
    });

    // Real-time broadcast to interested subscribers (e.g. Driver A tracking Driver B or Customer tracking Driver)
    socketService.broadcastDriverLocation({
      driverId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      heading: heading ? Number(heading) : 0,
      speedKmh: speedKmh ? Number(speedKmh) : 0,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        recordedAt: updated.lastPingAt
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
