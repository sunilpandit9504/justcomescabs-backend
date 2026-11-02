import { Router, Request, Response, NextFunction } from 'express';
import { financeService } from './finance.service.js';
import { authenticateToken, requireRoles, requireAdmin } from '../../common/middleware/auth.js';
import { UserRole } from '@gatigo/shared';
import { BadRequestError } from '../../common/errors.js';
import { db } from '../../services/db.js';

const router = Router();

// Get authenticated user's wallet
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await financeService.getWallet(req.user!.id);
    res.json({
      success: true,
      data: wallet
    });
  } catch (err) {
    next(err);
  }
});

// Get wallet transaction ledger
router.get('/transactions', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await financeService.getWalletTransactions(req.user!.id);
    res.json({
      success: true,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
});

// Top up wallet balance
router.post('/topup', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount = 1000 } = req.body;
    const wallet = await db.wallets.findByUserId(req.user!.id);
    const { balanceAfter } = await db.wallets.updateBalance(wallet.id, Number(amount), 'CREDIT');
    res.json({
      success: true,
      message: 'Wallet balance updated',
      data: { balance: balanceAfter }
    });
  } catch (err) {
    next(err);
  }
});

// Driver requests payout withdrawal
router.post('/payouts/request', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, payoutChannel = 'UPI_TRANSFER', upiId } = req.body;
    if (!amount) {
      throw new BadRequestError('Withdrawal amount is required');
    }

    const payout = await financeService.requestPayout(
      req.user!.driverId!,
      Number(amount),
      payoutChannel,
      upiId
    );

    res.status(201).json({
      success: true,
      message: 'Payout withdrawal requested successfully',
      data: payout
    });
  } catch (err) {
    next(err);
  }
});

// Driver views payout withdrawal requests
router.get('/payouts', authenticateToken, requireRoles(UserRole.DRIVER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payouts = await financeService.getDriverPayouts(req.user!.driverId!);
    res.json({
      success: true,
      data: payouts
    });
  } catch (err) {
    next(err);
  }
});

// Admin views pending payouts
router.get('/admin/pending', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await financeService.getPendingPayouts();
    res.json({
      success: true,
      data: pending
    });
  } catch (err) {
    next(err);
  }
});

// Admin approves payout
router.post('/admin/:id/approve', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bankReferenceId } = req.body;
    const result = await financeService.approvePayout(req.params.id, req.user!.id, bankReferenceId);
    res.json({
      success: true,
      message: 'Payout approved and settled',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// Admin rejects payout
router.post('/admin/:id/reject', authenticateToken, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason = 'Rejected by admin' } = req.body;
    const result = await financeService.rejectPayout(req.params.id, req.user!.id, reason);
    res.json({
      success: true,
      message: 'Payout rejected and refunded back to driver wallet',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
