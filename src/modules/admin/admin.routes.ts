import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../../common/middleware/auth.js';
import { db } from '../../services/db.js';
import { KycStatus, UserRole, BookingSource, BookingStatus } from '@gatigo/shared';
import { BadRequestError, NotFoundError } from '../../common/errors.js';

const router = Router();

// Dashboard Overview Metrics
router.get('/dashboard/stats', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allUsers = await db.users.listAll();
    const allDrivers = await db.driverProfiles.listAll();
    const allBookings = await db.bookings.listAll();
    const pendingPayouts = await db.payouts.listPending();

    const customerCount = allUsers.filter(u => u.role === UserRole.CUSTOMER).length;
    const verifiedDrivers = allDrivers.filter(d => d.kycStatus === KycStatus.VERIFIED).length;
    const pendingDrivers = allDrivers.filter(d => d.kycStatus === KycStatus.PENDING || d.kycStatus === KycStatus.UNDER_REVIEW).length;
    
    const onlineDrivers = (await db.driverAvailability.findOnlineDriversNearby(0, 0, 99999)).length;

    const normalRides = allBookings.filter(b => b.bookingSource === BookingSource.CUSTOMER_APP).length;
    const offlineBookings = allBookings.filter(b => b.bookingSource === BookingSource.OFFLINE_DRIVER_BOOKING).length;
    const sharedBookings = (await db.rideSharingRequests.findSharedByCreatorDriver('')).length; // or total sharing requests
    const activeRides = allBookings.filter(b => b.status === BookingStatus.IN_PROGRESS || b.status === BookingStatus.DRIVER_ARRIVING).length;
    const completedRides = allBookings.filter(b => b.status === BookingStatus.COMPLETED).length;

    const totalGmv = allBookings
      .filter(b => b.status === BookingStatus.COMPLETED)
      .reduce((sum, b) => sum + (Number(b.finalFare) || Number(b.estimatedFare) || 0), 0);

    res.json({
      success: true,
      data: {
        fleet: {
          totalDrivers: allDrivers.length,
          verifiedDrivers,
          pendingDrivers,
          onlineDrivers
        },
        customers: {
          totalCustomers: customerCount
        },
        bookings: {
          totalBookings: allBookings.length,
          normalCustomerRides: normalRides,
          driverOfflineBookings: offlineBookings,
          sharedOfflineBookings: sharedBookings,
          activeRides,
          completedRides
        },
        financials: {
          totalCompletedGmv: totalGmv,
          pendingPayoutsCount: pendingPayouts.length,
          pendingPayoutsTotal: pendingPayouts.reduce((sum, p) => sum + Number(p.amount), 0)
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// List drivers pending KYC approval
router.get('/drivers/pending-kyc', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pendingDrivers = await db.driverProfiles.listPendingKyc();
    const fullList = await Promise.all(pendingDrivers.map(async (driver) => {
      const user = await db.users.findById(driver.userId);
      const vehicles = await db.vehicles.findByDriverId(driver.id);
      const documents = await db.driverDocuments.findByDriverId(driver.id);
      return {
        driver,
        user,
        vehicles,
        documents
      };
    }));

    res.json({
      success: true,
      data: fullList
    });
  } catch (err) {
    next(err);
  }
});

// Approve driver KYC & vehicles
router.post('/drivers/:driverId/verify', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = req.params;
    const driver = await db.driverProfiles.findById(driverId);
    if (!driver) {
      throw new NotFoundError('Driver profile not found');
    }

    // Update driver KYC status to VERIFIED
    const updated = await db.driverProfiles.update(driverId, {
      kycStatus: KycStatus.VERIFIED,
      kycRejectionReason: undefined
    });

    // Verify all registered vehicles for this driver
    const vehicles = await db.vehicles.findByDriverId(driverId);
    for (const v of vehicles) {
      await db.vehicles.update(v.id, { isVerified: true });
    }

    // Also mark all driver documents as VERIFIED
    const docs = await db.driverDocuments.findByDriverId(driverId);
    for (const d of docs) {
      d.verificationStatus = 'VERIFIED';
      d.reviewedAt = new Date();
    }

    await db.auditLogs.create({
      actorId: req.user!.id,
      action: 'DRIVER_KYC_VERIFIED',
      entityType: 'DRIVER_PROFILE',
      entityId: driverId,
      changes: { oldStatus: driver.kycStatus, newStatus: KycStatus.VERIFIED }
    });

    res.json({
      success: true,
      message: 'Driver and associated vehicles verified successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Verify single document for a driver
router.post('/drivers/:driverId/documents/:docTypeOrId/verify', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId, docTypeOrId } = req.params;
    const docs = await db.driverDocuments.findByDriverId(driverId);
    let target = docs.find(d => d.id === docTypeOrId || d.documentType.toUpperCase() === docTypeOrId.toUpperCase());
    if (target) {
      target.verificationStatus = 'VERIFIED';
      target.reviewedAt = new Date();
    } else {
      target = await db.driverDocuments.create({
        driverId,
        documentType: docTypeOrId,
        fileUrl: '',
        verificationStatus: 'VERIFIED'
      });
    }

    res.json({
      success: true,
      message: `Document ${docTypeOrId} verified successfully`,
      data: target
    });
  } catch (err) {
    next(err);
  }
});

// Reject driver KYC
router.post('/drivers/:driverId/reject', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;
    if (!reason) {
      throw new BadRequestError('Rejection reason is required');
    }

    const driver = await db.driverProfiles.findById(driverId);
    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    const updated = await db.driverProfiles.update(driverId, {
      kycStatus: KycStatus.REJECTED,
      kycRejectionReason: reason
    });

    await db.auditLogs.create({
      actorId: req.user!.id,
      action: 'DRIVER_KYC_REJECTED',
      entityType: 'DRIVER_PROFILE',
      entityId: driverId,
      changes: { reason }
    });

    res.json({
      success: true,
      message: 'Driver verification rejected',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// List users & account state management
router.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await db.users.listAll();
    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/status', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { isActive, reason } = req.body;

    const user = await db.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const updated = await db.users.update(userId, { isActive: Boolean(isActive) });

    await db.auditLogs.create({
      actorId: req.user!.id,
      action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
      entityType: 'USER',
      entityId: userId,
      changes: { reason }
    });

    res.json({
      success: true,
      message: `User account is now ${isActive ? 'Active' : 'Suspended'}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// OPERATIONAL ZONES & GEOFENCING MANAGEMENT
// ==========================================

// List all operational zones (publicly accessible for apps & dashboard)
router.get('/zones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await db.zones.listAll();
    res.json({
      success: true,
      data: zones
    });
  } catch (err) {
    next(err);
  }
});

// Check if given Lat/Lng coordinates are in any active serviceable zone
router.post('/zones/check-serviceable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestError('latitude and longitude are required');
    }
    const result = await db.zones.checkServiceable(Number(latitude), Number(longitude));
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// Create new operational zone
router.post('/zones', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, district, state, centerLatitude, centerLongitude, radiusKm, surgeMultiplier, landmarks, isActive } = req.body;
    if (!name || !district || centerLatitude === undefined || centerLongitude === undefined) {
      throw new BadRequestError('name, district, centerLatitude and centerLongitude are required');
    }

    const created = await db.zones.create({
      name,
      district,
      state: state || 'Jharkhand',
      centerLatitude: Number(centerLatitude),
      centerLongitude: Number(centerLongitude),
      radiusKm: Number(radiusKm) || 20,
      surgeMultiplier: Number(surgeMultiplier) || 1.0,
      activeDrivers: 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      landmarks: landmarks || []
    });

    res.json({
      success: true,
      message: `Operational zone ${name} created successfully`,
      data: created
    });
  } catch (err) {
    next(err);
  }
});

// Update operational zone
router.put('/zones/:zoneId', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const existing = await db.zones.findById(zoneId);
    if (!existing) {
      throw new NotFoundError('Zone not found');
    }

    const updated = await db.zones.update(zoneId, req.body);
    res.json({
      success: true,
      message: 'Operational zone updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete operational zone
router.delete('/zones/:zoneId', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    await db.zones.delete(zoneId);
    res.json({
      success: true,
      message: 'Operational zone deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// List all Vehicle Models and Service Type mappings
router.get('/vehicle-models', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await db.vehicleModels.listAll();
    res.json({
      success: true,
      data: models
    });
  } catch (err) {
    next(err);
  }
});

// Create new Vehicle Model with Service Type
router.post('/vehicle-models', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { make, model, vehicleType, allowedServiceType, seatingCapacity, baseFare, perKmRate, minFare, description, isActive } = req.body;
    if (!make || !model || !vehicleType || !allowedServiceType) {
      throw new BadRequestError('make, model, vehicleType, and allowedServiceType (RIDE | DELIVERY | BOTH) are required');
    }

    const created = await db.vehicleModels.create({
      make,
      model,
      vehicleType,
      allowedServiceType,
      seatingCapacity: Number(seatingCapacity) || 4,
      baseFare: Number(baseFare) || 50,
      perKmRate: Number(perKmRate) || 15,
      minFare: Number(minFare) || 60,
      description: description || '',
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });

    res.json({
      success: true,
      message: `Vehicle model ${make} ${model} created successfully`,
      data: created
    });
  } catch (err) {
    next(err);
  }
});

// Update Vehicle Model (change service type, fares, capacity, status)
router.put('/vehicle-models/:id', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await db.vehicleModels.findById(id);
    if (!existing) {
      throw new NotFoundError('Vehicle model not found');
    }

    const updated = await db.vehicleModels.update(id, req.body);
    res.json({
      success: true,
      message: 'Vehicle model updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete Vehicle Model
router.delete('/vehicle-models/:id', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await db.vehicleModels.delete(id);
    res.json({
      success: true,
      message: 'Vehicle model deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
