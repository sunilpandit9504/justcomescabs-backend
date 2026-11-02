import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import { UserRole, KycStatus } from '@gatigo/shared';
import { db } from '../../services/db.js';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  driverId?: string;
  customerId?: string;
  adminId?: string;
  kycStatus?: KycStatus;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret) as any;
    req.user = {
      id: payload.sub,
      phone: payload.phone,
      role: payload.role as UserRole,
      driverId: payload.driverId,
      customerId: payload.customerId,
      adminId: payload.adminId,
      kycStatus: payload.kycStatus
    };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token has expired. Please refresh your session.'));
    }
    return next(new UnauthorizedError('Invalid access token'));
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(`Action requires one of the following roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new UnauthorizedError());
  }

  const adminRoles = [UserRole.SUPER_ADMIN, UserRole.OPERATIONS_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_AGENT];
  if (!adminRoles.includes(req.user.role)) {
    return next(new ForbiddenError('Administrative privileges required'));
  }

  next();
}

export async function requireDriverVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== UserRole.DRIVER) {
    return next(new ForbiddenError('Only drivers can perform this action'));
  }

  if (!req.user.driverId) {
    return next(new ForbiddenError('Driver profile not linked'));
  }

  const driver = await db.driverProfiles.findById(req.user.driverId);
  if (!driver || driver.kycStatus !== KycStatus.VERIFIED) {
    return next(new ForbiddenError('Driver identity and vehicle verification (KYC) must be approved by admin before taking this action'));
  }

  next();
}
