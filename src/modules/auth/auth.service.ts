import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { db } from '../../services/db.js';
import { smsService } from '../../services/sms.js';
import { BadRequestError, UnauthorizedError } from '../../common/errors.js';
import { UserRole, KycStatus, VehicleCategory } from '@gatigo/shared';
import { logger } from '../../common/logger.js';

function saveDocumentImage(driverId: string, docType: string, input: any): string | null {
  if (!input || typeof input !== 'string') return null;

  // If already an absolute http/https URL, keep it
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  // If already a relative /uploads URL, keep it
  if (input.startsWith('/uploads/')) {
    return input;
  }

  // Check if it's base64 or data URI
  let base64Data = input;
  let ext = 'jpg';

  if (input.includes(';base64,')) {
    const parts = input.split(';base64,');
    if (parts[0].includes('png')) ext = 'png';
    else if (parts[0].includes('webp')) ext = 'webp';
    base64Data = parts[1];
  } else if (input.startsWith('data:')) {
    return input;
  }

  try {
    const uploadsDir = path.resolve(process.cwd(), 'public/uploads/kyc');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const cleanDocType = docType.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${driverId.replace(/[^a-z0-9]/gi, '_')}_${cleanDocType}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length < 10) {
      return input.startsWith('data:') ? input : null;
    }

    fs.writeFileSync(filePath, buffer);
    logger.info(`Saved KYC document for driver ${driverId} to ${filePath} (${buffer.length} bytes)`);
    return `/uploads/kyc/${filename}`;
  } catch (err) {
    logger.warn(`Could not write KYC image to disk, keeping direct payload for driver ${driverId}`);
    return input.startsWith('data:') ? input : null;
  }
}

export class AuthService {
  public async sendOtp(phone: string, role: UserRole) {
    if (!phone || phone.length < 10) {
      throw new BadRequestError('Invalid phone number format');
    }

    const { sessionToken, expiresInSeconds, devOtp } = smsService.generateOtp(phone);

    return {
      sessionToken,
      expiresInSeconds,
      ...(config.env !== 'production' ? { devOtp } : {})
    };
  }

  public async verifyOtp(phone: string, otp: string, sessionToken?: string, requestedRole: UserRole = UserRole.CUSTOMER, name?: string) {
    const isValid = smsService.verifyOtp(phone, otp, sessionToken);
    if (!isValid) {
      throw new BadRequestError('Invalid or expired OTP');
    }

    let user = await db.users.findByPhone(phone);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await db.users.create({
        phone,
        name: name || (requestedRole === UserRole.DRIVER ? 'Partner Driver' : 'GatiGo Customer'),
        preferredLanguage: 'en',
        role: requestedRole,
        isActive: true,
        isVerified: true
      });
    }

    // Ensure wallet exists
    db.wallets.findByUserId(user.id);

    let customerProfileId: string | undefined;
    let driverProfileId: string | undefined;
    let kycStatus: KycStatus | undefined;

    if (user.role === UserRole.CUSTOMER || requestedRole === UserRole.CUSTOMER) {
      let customer = await db.customerProfiles.findByUserId(user.id);
      if (!customer) {
        customer = await db.customerProfiles.create({
          userId: user.id,
          ratingAverage: 5.0,
          totalTrips: 0
        });
      }
      customerProfileId = customer.id;
    }

    if (user.role === UserRole.DRIVER || requestedRole === UserRole.DRIVER) {
      let driver = await db.driverProfiles.findByUserId(user.id);
      if (!driver) {
        driver = await db.driverProfiles.create({
          userId: user.id,
          licenseNumber: 'PENDING_UPLOAD',
          experienceYears: 1,
          kycStatus: KycStatus.PENDING,
          serviceCity: 'Ranchi',
          operatingState: 'Jharkhand',
          ratingAverage: 5.0,
          totalCompletedTrips: 0,
          totalSharedCreated: 0,
          totalSharedFulfilled: 0
        });
      }
      driverProfileId = driver.id;
      kycStatus = driver.kycStatus;
    }

    const tokens = this.generateTokenPair({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      customerId: customerProfileId,
      driverId: driverProfileId,
      kycStatus
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isNewUser,
        customerId: customerProfileId,
        driverId: driverProfileId,
        kycStatus
      },
      ...tokens
    };
  }

  public async registerDriver(data: {
    name: string;
    phone: string;
    city?: string;
    vehicleCategory?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    serviceType?: string;
    dlNumber?: string;
    rcNumber?: string;
    insuranceNumber?: string;
    uploadedDocs?: Record<string, any>;
  }) {
    if (!data.phone || !data.name) {
      throw new BadRequestError('Driver name and phone number are required');
    }

    const cleanPhone = data.phone.trim();
    let user = await db.users.findByPhone(cleanPhone);
    if (!user) {
      user = await db.users.create({
        phone: cleanPhone,
        name: data.name.trim(),
        role: UserRole.DRIVER,
        isActive: false, // Inactive / Requested until Admin approves KYC
        isVerified: false,
        preferredLanguage: 'hi'
      });
    } else {
      user = await db.users.update(user.id, {
        name: data.name.trim(),
        role: UserRole.DRIVER,
        isActive: false,
        isVerified: false
      }) || user;
    }

    let driver = await db.driverProfiles.findByUserId(user.id);
    if (!driver) {
      driver = await db.driverProfiles.create({
        userId: user.id,
        licenseNumber: data.dlNumber || 'PENDING',
        experienceYears: 3,
        kycStatus: KycStatus.UNDER_REVIEW,
        serviceCity: data.city || 'Godda',
        operatingState: 'Jharkhand',
        ratingAverage: 5.0,
        totalCompletedTrips: 0,
        totalSharedCreated: 0,
        totalSharedFulfilled: 0
      });
    } else {
      driver = await db.driverProfiles.update(driver.id, {
        licenseNumber: data.dlNumber || driver.licenseNumber,
        serviceCity: data.city || driver.serviceCity,
        kycStatus: KycStatus.UNDER_REVIEW,
        kycRejectionReason: undefined
      }) || driver;
    }

    // Vehicle setup
    const vehicles = await db.vehicles.findByDriverId(driver.id);
    const category = (data.vehicleCategory?.toUpperCase() as VehicleCategory) || VehicleCategory.SEDAN;
    const plate = data.vehiclePlate?.trim() || `JH-${Date.now().toString().slice(-4)}`;

    if (vehicles.length === 0) {
      await db.vehicles.create({
        driverId: driver.id,
        category,
        registrationNumber: plate,
        make: data.vehicleMake?.trim() || 'Maruti Suzuki',
        model: data.vehicleModel?.trim() || 'Dzire Tour',
        color: 'White',
        year: new Date().getFullYear(),
        seatingCapacity: category === VehicleCategory.AUTO ? 3 : category === VehicleCategory.SUV ? 6 : 4,
        isAc: true,
        rcNumber: data.rcNumber?.trim() || plate,
        isVerified: false,
        isActive: true
      });
    } else {
      await db.vehicles.update(vehicles[0].id, {
        category,
        registrationNumber: plate,
        make: data.vehicleMake?.trim() || vehicles[0].make,
        model: data.vehicleModel?.trim() || vehicles[0].model,
        rcNumber: data.rcNumber?.trim() || vehicles[0].rcNumber,
        isVerified: false
      });
    }

    // Documents setup - strictly use driver uploaded documents with NO unsplash dummy fallbacks
    const docs = data.uploadedDocs || {};

    const savedDl = saveDocumentImage(driver.id, 'dl', docs.dl);
    const savedRc = saveDocumentImage(driver.id, 'rc', docs.rc);
    const savedIns = saveDocumentImage(driver.id, 'insurance', docs.insurance);
    const savedSelfie = saveDocumentImage(driver.id, 'selfie', docs.selfie);

    if (savedSelfie) {
      user.avatarUrl = savedSelfie;
      await db.users.update(user.id, { avatarUrl: savedSelfie });
    }

    const documentSpecs = [
      { type: 'DRIVING_LICENSE_FRONT', number: data.dlNumber, url: savedDl || (typeof docs.dl === 'string' ? docs.dl : '') },
      { type: 'VEHICLE_RC', number: data.rcNumber, url: savedRc || (typeof docs.rc === 'string' ? docs.rc : '') },
      { type: 'VEHICLE_INSURANCE', number: data.insuranceNumber, url: savedIns || (typeof docs.insurance === 'string' ? docs.insurance : '') },
      { type: 'DRIVER_PHOTO_SELFIE', number: undefined, url: savedSelfie || (typeof docs.selfie === 'string' ? docs.selfie : '') }
    ];

    const existingDocs = await db.driverDocuments.findByDriverId(driver.id);
    for (const spec of documentSpecs) {
      const match = existingDocs.find(d => d.documentType === spec.type);
      if (!match) {
        await db.driverDocuments.create({
          driverId: driver.id,
          documentType: spec.type,
          fileUrl: spec.url,
          documentNumber: spec.number,
          verificationStatus: 'PENDING'
        });
      } else {
        match.documentNumber = spec.number || match.documentNumber;
        match.fileUrl = spec.url || match.fileUrl;
        match.verificationStatus = 'PENDING';
        match.reviewedAt = undefined;
      }
    }

    // Availability
    await db.driverAvailability.upsert(driver.id, {
      isOnline: false,
      currentLatitude: 24.8267,
      currentLongitude: 87.2156
    });

    // Wallet
    let wallet = await db.wallets.findByUserId(user.id);
    if (!wallet) {
      wallet = await db.wallets.create({
        userId: user.id,
        currency: 'INR',
        balance: 650.0,
        lockedBalance: 0,
        isFrozen: false
      });
    }

    const tokens = this.generateTokenPair({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      driverId: driver.id,
      kycStatus: KycStatus.UNDER_REVIEW
    });

    logger.info(`New Driver registered successfully: ${user.name} (${user.phone}) - KYC status: UNDER_REVIEW`);

    return {
      driver: {
        id: driver.id,
        userId: user.id,
        name: user.name,
        phone: user.phone,
        serviceCity: driver.serviceCity,
        kycStatus: driver.kycStatus
      },
      ...tokens
    };
  }

  public async adminLogin(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // Direct master admin login for Justcomes Cab
    if (
      (cleanEmail === 'admin@justcomes.in' || cleanEmail === 'admin@gatigo.in') &&
      (cleanPass === 'Priyansh@9504' || cleanPass === 'AdminPassword@2026')
    ) {
      let user = await db.users.findByEmail(cleanEmail);
      if (!user) {
        user = await db.users.create({
          phone: '+919504329735',
          email: cleanEmail,
          name: 'Justcomes Chief Admin',
          preferredLanguage: 'hi',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          isVerified: true
        });
      }
      let admin = await db.adminUsers.findByUserId(user.id);
      if (!admin) {
        admin = await db.adminUsers.create({
          userId: user.id,
          department: 'CENTRAL_OPERATIONS',
          passwordHash: await bcrypt.hash(cleanPass, 10)
        });
      }
      const tokens = this.generateTokenPair({
        userId: user.id,
        phone: user.phone,
        role: user.role,
        adminId: admin.id
      });
      return {
        admin: {
          id: admin.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: admin.department
        },
        ...tokens
      };
    }

    const user = await db.users.findByEmail(cleanEmail);
    if (!user) {
      throw new UnauthorizedError('Invalid admin email or password');
    }

    const admin = await db.adminUsers.findByUserId(user.id);
    if (!admin) {
      throw new UnauthorizedError('Administrative credentials not found for this account');
    }

    const isMatch = await bcrypt.compare(cleanPass, admin.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid admin email or password');
    }

    const tokens = this.generateTokenPair({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      adminId: admin.id
    });

    return {
      admin: {
        id: admin.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: admin.department
      },
      ...tokens
    };
  }

  public async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
      const user = await db.users.findById(decoded.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('User session is no longer active');
      }

      const customer = await db.customerProfiles.findByUserId(user.id);
      const driver = await db.driverProfiles.findByUserId(user.id);
      const admin = await db.adminUsers.findByUserId(user.id);

      return this.generateTokenPair({
        userId: user.id,
        phone: user.phone,
        role: user.role,
        customerId: customer?.id,
        driverId: driver?.id,
        adminId: admin?.id,
        kycStatus: driver?.kycStatus
      });
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  private generateTokenPair(claims: {
    userId: string;
    phone: string;
    role: UserRole;
    customerId?: string;
    driverId?: string;
    adminId?: string;
    kycStatus?: KycStatus;
  }) {
    const accessToken = jwt.sign(
      {
        sub: claims.userId,
        phone: claims.phone,
        role: claims.role,
        customerId: claims.customerId,
        driverId: claims.driverId,
        adminId: claims.adminId,
        kycStatus: claims.kycStatus
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    const refreshToken = jwt.sign(
      {
        sub: claims.userId,
        role: claims.role
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any }
    );

    return { accessToken, refreshToken, expiresIn: config.jwt.expiresIn };
  }
}

export const authService = new AuthService();
