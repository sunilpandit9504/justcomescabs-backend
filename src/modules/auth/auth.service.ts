import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../../config/index.js';
import { db } from '../../services/db.js';
import { smsService } from '../../services/sms.js';
import { BadRequestError, UnauthorizedError } from '../../common/errors.js';
import { UserRole, KycStatus } from '@gatigo/shared';
import { logger } from '../../common/logger.js';

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

  public async adminLogin(email: string, password: string) {
    const user = await db.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid admin email or password');
    }

    const admin = await db.adminUsers.findByUserId(user.id);
    if (!admin) {
      throw new UnauthorizedError('Administrative credentials not found for this account');
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
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
