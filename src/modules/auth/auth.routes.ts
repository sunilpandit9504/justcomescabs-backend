import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticateToken } from '../../common/middleware/auth.js';

const router = Router();

router.post('/otp/send', (req, res, next) => authController.sendOtp(req, res, next));
router.post('/otp/verify', (req, res, next) => authController.verifyOtp(req, res, next));
router.post('/refresh-token', (req, res, next) => authController.refreshToken(req, res, next));
router.post('/admin/login', (req, res, next) => authController.adminLogin(req, res, next));
router.get('/me', authenticateToken, (req, res, next) => authController.getMe(req, res, next));

export default router;
