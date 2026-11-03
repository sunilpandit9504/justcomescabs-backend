import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { db } from '../../services/db.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';

export class AuthController {
  public async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, role = UserRole.CUSTOMER } = req.body;
      if (!phone) {
        throw new BadRequestError('Phone number is required');
      }

      const result = await authService.sendOtp(phone, role);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'OTP sent successfully',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  public async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, otp, sessionToken, role, name } = req.body;
      if (!phone || !otp) {
        throw new BadRequestError('Phone and OTP are required');
      }

      const result = await authService.verifyOtp(phone, otp, sessionToken, role, name);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Authentication successful',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  public async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new BadRequestError('Refresh token is required');
      }

      const result = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Tokens refreshed successfully',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  public async adminLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw new BadRequestError('Email and password are required');
      }

      const result = await authService.adminLogin(email, password);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Admin authentication successful',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  public async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const user = await db.users.findById(req.user.id);
      const customer = req.user.customerId ? await db.customerProfiles.findById(req.user.customerId) : null;
      const driver = req.user.driverId ? await db.driverProfiles.findById(req.user.driverId) : null;
      const wallet = await db.wallets.findByUserId(req.user.id);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          user,
          customerProfile: customer,
          driverProfile: driver,
          wallet
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  public async registerDriver(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.registerDriver(req.body);
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Driver registration and KYC submitted successfully! Under review by Admin.',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
