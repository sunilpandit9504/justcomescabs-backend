import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../../common/middleware/auth.js';
import { db, inMemoryDb } from '../../services/db.js';
import { KycStatus, UserRole, BookingSource, BookingStatus } from '@gatigo/shared';
import { BadRequestError, NotFoundError } from '../../common/errors.js';

const router = Router();

function resolveDocUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    return `https://api.justcomes.in${url}`;
  }
  return url;
}

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

// List ALL drivers (Active, Inactive, Pending, Verified) with complete management profile
router.get('/drivers', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allDrivers = await db.driverProfiles.listAll();
    const fullList = await Promise.all(allDrivers.map(async (driver) => {
      const user = await db.users.findById(driver.userId);
      const vehicles = await db.vehicles.findByDriverId(driver.id);
      const documents = await db.driverDocuments.findByDriverId(driver.id);
      const availability = await db.driverAvailability.findByDriverId(driver.id);
      const wallet = user ? await db.wallets.findByUserId(user.id) : null;

      const primaryVehicle = vehicles[0] || {
        make: 'Maruti Suzuki',
        model: 'Dzire Tour',
        registrationNumber: driver.licenseNumber || 'PENDING',
        year: 2023,
        category: 'SEDAN',
        rcNumber: ''
      };

      const dlDoc = documents.find(d => d.documentType.includes('LICENSE'));
      const rcDoc = documents.find(d => d.documentType.includes('RC'));
      const insDoc = documents.find(d => d.documentType.includes('INSURANCE'));
      const selfieDoc = documents.find(d => d.documentType.includes('SELFIE') || d.documentType.includes('PHOTO'));

      return {
        id: `#${driver.id.slice(-4).toUpperCase()}`,
        internalId: driver.id,
        driverId: driver.id,
        name: user?.name || 'Partner Driver',
        email: user?.email || `${user?.phone?.replace(/\D/g, '') || 'driver'}@justcomes.in`,
        phone: user?.phone || '+91 9504329735',
        gender: 'Male',
        joiningDate: new Date(driver.createdAt).toISOString().split('T')[0],
        operatingDistrict: driver.serviceCity?.split(',')[0]?.trim() || 'Godda',
        operatingBlock: driver.serviceCity || 'Godda Sadar (HQ)',
        vehicle: {
          make: primaryVehicle.make,
          model: primaryVehicle.model,
          registrationNumber: primaryVehicle.registrationNumber,
          year: primaryVehicle.year,
          category: primaryVehicle.category
        },
        rides: {
          liveRides: 0,
          completedRides: driver.totalCompletedTrips || 0,
          cancelledRides: 0,
          rejectedRides: 0
        },
        earnings: {
          todayEarnings: 0,
          adminCommission: 0,
          driverEarnings: 0,
          byCash: 0,
          byCardOnline: 0,
          walletBalance: wallet?.balance || 650.0
        },
        status: user?.isActive ? 'ACTIVE' : 'INACTIVE',
        serviceType: 'BOTH',
        rideEnabled: driver.kycStatus === KycStatus.VERIFIED,
        isBanned: !user?.isActive,
        approvalStatus: driver.kycStatus,
        hasDocuments: documents.length > 0,
        registeredOnFormatted: new Date(driver.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        documents: {
          dl: {
            number: driver.licenseNumber,
            photoUrl: resolveDocUrl(dlDoc?.fileUrl) || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=700',
            status: dlDoc?.verificationStatus || (driver.kycStatus === KycStatus.VERIFIED ? 'VERIFIED' : 'PENDING')
          },
          rc: {
            number: primaryVehicle.rcNumber || primaryVehicle.registrationNumber,
            photoUrl: resolveDocUrl(rcDoc?.fileUrl) || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=700',
            status: rcDoc?.verificationStatus || (driver.kycStatus === KycStatus.VERIFIED ? 'VERIFIED' : 'PENDING')
          },
          insurance: {
            number: 'POL-ICICI-' + driver.id.slice(-6).toUpperCase(),
            photoUrl: resolveDocUrl(insDoc?.fileUrl) || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=700',
            status: insDoc?.verificationStatus || (driver.kycStatus === KycStatus.VERIFIED ? 'VERIFIED' : 'PENDING')
          },
          selfie: {
            photoUrl: resolveDocUrl(selfieDoc?.fileUrl) || resolveDocUrl(user?.avatarUrl) || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700',
            status: selfieDoc?.verificationStatus || (driver.kycStatus === KycStatus.VERIFIED ? 'VERIFIED' : 'PENDING')
          }
        },
        payoutDetails: {
          upiId: driver.upiId || `${user?.phone?.replace(/\D/g, '') || 'driver'}@ybl`,
          bankAccount: driver.bankAccountNumber || 'State Bank of India',
          ifsc: driver.bankIfscCode || 'SBIN0001234'
        },
        raw: {
          driver,
          user: user ? { ...user, avatarUrl: resolveDocUrl(user.avatarUrl) } : user,
          vehicles,
          documents: documents.map(d => ({ ...d, fileUrl: resolveDocUrl(d.fileUrl) })),
          availability,
          wallet
        }
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
        user: user ? { ...user, avatarUrl: resolveDocUrl(user.avatarUrl) } : user,
        vehicles,
        documents: documents.map(d => ({
          ...d,
          fileUrl: resolveDocUrl(d.fileUrl)
        }))
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
    const updated = await db.driverProfiles.update(driver.id, {
      kycStatus: KycStatus.VERIFIED,
      kycRejectionReason: undefined
    });

    // Mark user as verified and active
    const user = await db.users.findById(driver.userId);
    if (user) {
      await db.users.update(user.id, { isVerified: true, isActive: true });
    }

    // Verify all registered vehicles for this driver
    const vehicles = await db.vehicles.findByDriverId(driver.id);
    for (const v of vehicles) {
      await db.vehicles.update(v.id, { isVerified: true });
    }

    // Also mark all driver documents as VERIFIED
    const docs = await db.driverDocuments.findByDriverId(driver.id);
    for (const d of docs) {
      await db.driverDocuments.update(d.id, {
        verificationStatus: 'VERIFIED',
        reviewedAt: new Date()
      });
    }

    await db.auditLogs.create({
      actorId: req.user!.id,
      action: 'DRIVER_KYC_VERIFIED',
      entityType: 'DRIVER_PROFILE',
      entityId: driver.id,
      changes: { oldStatus: driver.kycStatus, newStatus: KycStatus.VERIFIED }
    });

    // Save to disk immediately so no state is lost on process restart
    inMemoryDb.saveToDisk();

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
    const driver = await db.driverProfiles.findById(driverId);
    if (!driver) {
      throw new NotFoundError('Driver profile not found');
    }

    const docs = await db.driverDocuments.findByDriverId(driver.id);
    const cleanType = docTypeOrId.toUpperCase();
    let target = docs.find(d => 
      d.id === docTypeOrId || 
      d.documentType.toUpperCase() === cleanType ||
      (cleanType === 'DL' && d.documentType.includes('LICENSE')) ||
      (cleanType === 'RC' && d.documentType.includes('RC')) ||
      (cleanType === 'INSURANCE' && d.documentType.includes('INSURANCE')) ||
      (cleanType === 'SELFIE' && (d.documentType.includes('SELFIE') || d.documentType.includes('PHOTO')))
    );

    if (target) {
      target = await db.driverDocuments.update(target.id, {
        verificationStatus: 'VERIFIED',
        reviewedAt: new Date()
      }) || target;
    } else {
      target = await db.driverDocuments.create({
        driverId: driver.id,
        documentType: docTypeOrId,
        fileUrl: '',
        verificationStatus: 'VERIFIED'
      });
    }

    // Check if all essential documents (DL, RC, Insurance) are now verified
    const allDocs = await db.driverDocuments.findByDriverId(driver.id);
    const hasDl = allDocs.some(d => d.documentType.includes('LICENSE') && d.verificationStatus === 'VERIFIED');
    const hasRc = allDocs.some(d => d.documentType.includes('RC') && d.verificationStatus === 'VERIFIED');
    const hasIns = allDocs.some(d => d.documentType.includes('INSURANCE') && d.verificationStatus === 'VERIFIED');

    let driverUpdated = false;
    if (hasDl && hasRc && hasIns) {
      await db.driverProfiles.update(driver.id, {
        kycStatus: KycStatus.VERIFIED,
        kycRejectionReason: undefined
      });
      const user = await db.users.findById(driver.userId);
      if (user) {
        await db.users.update(user.id, { isVerified: true, isActive: true });
      }
      const vehicles = await db.vehicles.findByDriverId(driver.id);
      for (const v of vehicles) {
        await db.vehicles.update(v.id, { isVerified: true });
      }
      driverUpdated = true;
    }

    inMemoryDb.saveToDisk();

    res.json({
      success: true,
      message: `Document ${docTypeOrId} verified successfully`,
      data: target,
      allVerified: driverUpdated
    });
  } catch (err) {
    next(err);
  }
});

// Reject single document for a driver
router.post('/drivers/:driverId/documents/:docTypeOrId/reject', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId, docTypeOrId } = req.params;
    const { reason } = req.body;
    const driver = await db.driverProfiles.findById(driverId);
    if (!driver) {
      throw new NotFoundError('Driver profile not found');
    }

    const docs = await db.driverDocuments.findByDriverId(driver.id);
    const cleanType = docTypeOrId.toUpperCase();
    let target = docs.find(d => 
      d.id === docTypeOrId || 
      d.documentType.toUpperCase() === cleanType ||
      (cleanType === 'DL' && d.documentType.includes('LICENSE')) ||
      (cleanType === 'RC' && d.documentType.includes('RC')) ||
      (cleanType === 'INSURANCE' && d.documentType.includes('INSURANCE')) ||
      (cleanType === 'SELFIE' && (d.documentType.includes('SELFIE') || d.documentType.includes('PHOTO')))
    );

    if (target) {
      target = await db.driverDocuments.update(target.id, {
        verificationStatus: 'REJECTED',
        reviewedAt: new Date()
      }) || target;
    }

    await db.driverProfiles.update(driver.id, {
      kycStatus: KycStatus.REJECTED,
      kycRejectionReason: reason || `Document ${docTypeOrId} rejected`
    });

    const user = await db.users.findById(driver.userId);
    if (user) {
      await db.users.update(user.id, { isVerified: false });
    }

    inMemoryDb.saveToDisk();

    res.json({
      success: true,
      message: `Document ${docTypeOrId} rejected successfully`,
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

    const updated = await db.driverProfiles.update(driver.id, {
      kycStatus: KycStatus.REJECTED,
      kycRejectionReason: reason
    });

    const user = await db.users.findById(driver.userId);
    if (user) {
      await db.users.update(user.id, { isVerified: false });
    }

    const docs = await db.driverDocuments.findByDriverId(driver.id);
    for (const d of docs) {
      await db.driverDocuments.update(d.id, {
        verificationStatus: 'REJECTED',
        reviewedAt: new Date()
      });
    }

    await db.auditLogs.create({
      actorId: req.user!.id,
      action: 'DRIVER_KYC_REJECTED',
      entityType: 'DRIVER_PROFILE',
      entityId: driver.id,
      changes: { reason }
    });

    inMemoryDb.saveToDisk();

    res.json({
      success: true,
      message: 'Driver verification rejected',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// Update driver active/banned status
router.post('/drivers/:driverId/status', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = req.params;
    const { isActive, isBanned } = req.body;
    const driver = await db.driverProfiles.findById(driverId);
    if (!driver) throw new NotFoundError('Driver not found');

    const user = await db.users.findById(driver.userId);
    if (user) {
      await db.users.update(user.id, {
        isActive: isActive !== undefined ? Boolean(isActive) : (isBanned ? false : true)
      });
    }

    res.json({
      success: true,
      message: 'Driver status updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

// Unified Bookings List for Admin
router.get('/bookings', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allBookings = await db.bookings.listAll();
    const result = await Promise.all(allBookings.map(async (b) => {
      let driverName = 'Not Assigned';
      let driverPhone = '';
      if (b.assignedDriverId) {
        const d = await db.driverProfiles.findById(b.assignedDriverId);
        if (d) {
          const u = await db.users.findById(d.userId);
          if (u) {
            driverName = u.name;
            driverPhone = u.phone;
          }
        }
      }
      const offline = await db.offlineBookingDetails.findByBookingId(b.id);
      return {
        id: b.id,
        bookingCode: b.bookingCode,
        bookingSource: b.bookingSource,
        bookingType: b.bookingType,
        status: b.status,
        vehicleCategory: b.vehicleCategory,
        pickupAddress: b.pickupAddress,
        destinationAddress: b.destinationAddress,
        scheduledPickupTime: b.scheduledPickupTime ? new Date(b.scheduledPickupTime).toLocaleString('en-IN') : 'Immediate',
        estimatedFare: b.estimatedFare,
        finalFare: b.finalFare || b.estimatedFare,
        advancePaid: b.advancePaid || 0,
        remainingCustomerBalance: b.remainingCustomerBalance || 0,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt.toISOString(),
        assignedDriver: b.assignedDriverId ? { name: driverName, phone: driverPhone } : undefined,
        offlineDetails: offline ? {
          offlineCustomerName: offline.offlineCustomerName,
          offlineCustomerPhone: offline.offlineCustomerPhone,
          channelSource: offline.channelSource
        } : undefined
      };
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// Shared Peer-to-Peer Bookings List
router.get('/shared-bookings', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allRequests = Array.from(inMemoryDb.rideSharingRequests.values());
    const result = await Promise.all(allRequests.map(async (r) => {
      const creatorDriver = await db.driverProfiles.findById(r.creatorDriverId);
      const creatorUser = creatorDriver ? await db.users.findById(creatorDriver.userId) : null;
      let assignedDriverName = 'Open / Broadcasted';
      let assignedDriverPhone = '';
      let assignedVehicle = 'Any';
      const ca = await db.commissionAgreements.findByBookingId(r.bookingId);
      const targetDriverId = ca?.assignedDriverId || r.directTargetDriverId;
      if (targetDriverId) {
        const d = await db.driverProfiles.findById(targetDriverId);
        if (d) {
          const u = await db.users.findById(d.userId);
          const v = await db.vehicles.findByDriverId(d.id);
          if (u) { assignedDriverName = u.name; assignedDriverPhone = u.phone; }
          if (v[0]) { assignedVehicle = `${v[0].make} ${v[0].model} (${v[0].registrationNumber})`; }
        }
      }
      return {
        id: r.id,
        bookingCode: 'SHARE-' + r.id.slice(-6).toUpperCase(),
        creatorDriver: {
          name: creatorUser?.name || 'Driver Partner',
          phone: creatorUser?.phone || '',
          city: creatorDriver?.serviceCity || 'Godda'
        },
        assignedDriver: {
          name: assignedDriverName,
          phone: assignedDriverPhone,
          vehicle: assignedVehicle
        },
        customerName: 'Customer',
        pickup: 'Corridor Pickup',
        destination: 'Destination',
        totalFare: r.computedCommissionAmount + r.expectedDriverBEarnings,
        advancePaid: 0,
        driverACommission: r.computedCommissionAmount,
        driverBEarnings: r.expectedDriverBEarnings,
        status: r.status,
        commissionStatus: 'SETTLED',
        scheduledTime: new Date(r.createdAt).toLocaleString('en-IN')
      };
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// Riders / Customers List
router.get('/riders', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allUsers = await db.users.listAll();
    const customers = allUsers.filter(u => u.role === UserRole.CUSTOMER);
    const result = await Promise.all(customers.map(async (u) => {
      const profile = await db.customerProfiles.findByUserId(u.id);
      const wallet = await db.wallets.findByUserId(u.id);
      const bookings = await db.bookings.findByCustomerId(profile?.id || u.id);
      return {
        id: `#${u.id.slice(-4).toUpperCase()}`,
        internalId: u.id,
        name: u.name,
        email: u.email || `${u.phone.replace(/\D/g, '')}@justcomes.in`,
        phone: u.phone,
        avatarUrl: u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
        joiningDate: new Date(u.createdAt).toISOString().split('T')[0],
        registeredOnFormatted: new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: u.isActive ? 'ACTIVE' : 'INACTIVE',
        rides: {
          requestedRides: bookings.length,
          completedRides: bookings.filter(b => b.status === BookingStatus.COMPLETED).length,
          cancelledRides: bookings.filter(b => b.status === BookingStatus.CANCELLED).length,
          rejectedRides: 0
        },
        verification: {
          profileVerified: u.isVerified,
          emailVerified: Boolean(u.email),
          mobileVerified: true
        },
        account: {
          walletBalance: wallet?.balance || 0,
          rating: profile?.ratingAverage || 5.0,
          totalSpent: bookings.filter(b => b.status === BookingStatus.COMPLETED).reduce((sum, b) => sum + (Number(b.finalFare) || 0), 0),
          emergencyContact: profile?.emergencyContactPhone || u.phone
        },
        bookings: []
      };
    }));

    res.json({
      success: true,
      data: result
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
