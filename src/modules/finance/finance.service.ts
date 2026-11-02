import { db } from '../../services/db.js';
import { socketService } from '../socket/socket.service.js';
import {
  WalletTransactionType,
  PayoutStatus
} from '@gatigo/shared';
import { BadRequestError, NotFoundError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';

export class FinanceService {
  /**
   * Settles the frozen CommissionAgreement when a shared booking completes
   */
  public async settleSharedBookingCommission(bookingId: string) {
    const agreement = await db.commissionAgreements.findByBookingId(bookingId);
    if (!agreement) {
      logger.warn(`No commission agreement found for booking ${bookingId}`);
      return null;
    }

    if (agreement.settlementStatus === 'SETTLED') {
      logger.info(`Commission for booking ${bookingId} already settled (Idempotent bypass)`);
      return agreement;
    }

    const booking = await db.bookings.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

    const creatorDriver = await db.driverProfiles.findById(agreement.creatorDriverId);
    if (!creatorDriver) throw new NotFoundError('Creator driver not found');

    const creatorUser = await db.users.findById(creatorDriver.userId);
    if (!creatorUser) throw new NotFoundError('Creator user not found');

    const commissionAmount = Number(agreement.creatorCommissionAmount);

    // 1. Credit Driver A Wallet with unique idempotency key
    const idempotencyKey = `COMMISSION_SETTLE_${bookingId}_${agreement.id}`;
    const creatorWallet = await db.wallets.findByUserId(creatorUser.id);

    const { balanceBefore, balanceAfter } = await db.wallets.updateBalance(creatorWallet.id, commissionAmount, 'CREDIT');

    await db.walletTransactions.create({
      walletId: creatorWallet.id,
      idempotencyKey,
      referenceBookingId: bookingId,
      type: WalletTransactionType.COMMISSION_EARNING,
      direction: 'CREDIT',
      amount: commissionAmount,
      balanceBefore,
      balanceAfter,
      status: 'SETTLED',
      description: `Commission earned for shared offline trip ${booking.bookingCode} (Assigned to Driver B)`,
      metadata: {
        totalFare: agreement.totalFare,
        creatorCommission: commissionAmount,
        advanceCollected: agreement.advanceCollectedByCreator,
        driverBEarnings: agreement.assignedDriverNetEarnings
      }
    });

    // 2. Deduct admin's platform charge from Driver B's wallet (ONLY the platform fee set by admin)
    const platformFee = Number(agreement.platformFeeAmount || 0);
    if (platformFee > 0 && agreement.assignedDriverId) {
      const assignedDriver = await db.driverProfiles.findById(agreement.assignedDriverId);
      if (assignedDriver) {
        const assignedUser = await db.users.findById(assignedDriver.userId);
        if (assignedUser) {
          const driverBWallet = await db.wallets.findByUserId(assignedUser.id);
          const { balanceBefore: bBefore, balanceAfter: bAfter } = await db.wallets.updateBalance(
            driverBWallet.id,
            platformFee,
            'DEBIT'
          );

          await db.walletTransactions.create({
            walletId: driverBWallet.id,
            idempotencyKey: `PLATFORM_FEE_${bookingId}_${agreement.id}`,
            referenceBookingId: bookingId,
            type: WalletTransactionType.PLATFORM_FEE_DEDUCTION,
            direction: 'DEBIT',
            amount: platformFee,
            balanceBefore: bBefore,
            balanceAfter: bAfter,
            status: 'SETTLED',
            description: `Admin platform fee deducted for trip ${booking.bookingCode}`,
            metadata: {
              bookingCode: booking.bookingCode,
              platformFee,
              totalFare: agreement.totalFare
            }
          });

          logger.info(`Admin Platform Fee: ₹${platformFee} deducted from Driver B (${assignedUser.name}) for trip ${booking.bookingCode}`);
        }
      }
    }

    // 3. Mark CommissionAgreement as SETTLED
    const updatedAgreement = await db.commissionAgreements.update(agreement.id, {
      settlementStatus: 'SETTLED',
      settledAt: new Date()
    });

    // 3. Emit real-time notification to Driver A
    socketService.emitCommissionCredited(creatorDriver.id, {
      bookingId,
      bookingCode: booking.bookingCode,
      amount: commissionAmount,
      newWalletBalance: balanceAfter,
      settledAt: new Date()
    });

    logger.info(`Commission settled: ₹${commissionAmount} credited to Driver A (${creatorUser.name}) for booking ${booking.bookingCode}`);

    return updatedAgreement;
  }

  /**
   * Gets user wallet balance & status
   */
  public async getWallet(userId: string) {
    const wallet = await db.wallets.findByUserId(userId);
    return wallet;
  }

  /**
   * Gets paginated transaction ledger
   */
  public async getWalletTransactions(userId: string) {
    const wallet = await db.wallets.findByUserId(userId);
    const transactions = await db.walletTransactions.findByWalletId(wallet.id);
    return transactions;
  }

  /**
   * Driver requests payout withdrawal
   */
  public async requestPayout(driverId: string, amount: number, payoutChannel = 'UPI_TRANSFER', upiId?: string) {
    if (amount <= 0) {
      throw new BadRequestError('Payout amount must be greater than zero');
    }

    const driver = await db.driverProfiles.findById(driverId);
    if (!driver) throw new NotFoundError('Driver profile not found');

    const wallet = await db.wallets.findByUserId(driver.userId);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestError(`Insufficient wallet balance. Available: ₹${wallet.balance}, Requested: ₹${amount}`);
    }

    // Debit available wallet balance
    const { balanceBefore, balanceAfter } = await db.wallets.updateBalance(wallet.id, amount, 'DEBIT');

    const payout = await db.payouts.create({
      driverId,
      amount,
      status: PayoutStatus.REQUESTED,
      payoutChannel,
      bankReferenceId: upiId || driver.upiId || 'Pending processing'
    });

    await db.walletTransactions.create({
      walletId: wallet.id,
      idempotencyKey: `PAYOUT_REQ_${payout.id}`,
      type: WalletTransactionType.PAYOUT_WITHDRAWAL,
      direction: 'DEBIT',
      amount,
      balanceBefore,
      balanceAfter,
      status: 'PENDING',
      description: `Withdrawal request via ${payoutChannel} (Payout ID: ${payout.id.substring(0, 8)}...)`,
      metadata: { payoutId: payout.id, upiId: upiId || driver.upiId }
    });

    logger.info(`Payout requested: ₹${amount} by Driver ${driverId}`);

    return payout;
  }

  /**
   * Admin approves and finalizes payout
   */
  public async approvePayout(payoutId: string, adminId: string, bankReferenceId: string) {
    const payout = (await db.payouts.listPending()).find(p => p.id === payoutId);
    if (!payout) {
      throw new NotFoundError('Pending payout request not found');
    }

    const updated = await db.payouts.update(payoutId, {
      status: PayoutStatus.COMPLETED,
      bankReferenceId: bankReferenceId || `UPI-TXN-${Date.now()}`,
      settledAt: new Date()
    });

    await db.auditLogs.create({
      actorId: adminId,
      action: 'PAYOUT_APPROVED',
      entityType: 'PAYOUT',
      entityId: payoutId,
      changes: { amount: payout.amount, bankReferenceId }
    });

    logger.info(`Payout approved: ID ${payoutId} for ₹${payout.amount} (Ref: ${bankReferenceId})`);

    return updated;
  }

  /**
   * Admin rejects payout and returns funds to driver wallet
   */
  public async rejectPayout(payoutId: string, adminId: string, failureReason: string) {
    const payout = (await db.payouts.listPending()).find(p => p.id === payoutId);
    if (!payout) {
      throw new NotFoundError('Pending payout request not found');
    }

    const driver = await db.driverProfiles.findById(payout.driverId);
    if (!driver) throw new NotFoundError('Driver not found');

    const wallet = await db.wallets.findByUserId(driver.userId);

    // Refund amount back to driver wallet
    const { balanceBefore, balanceAfter } = await db.wallets.updateBalance(wallet.id, Number(payout.amount), 'CREDIT');

    await db.walletTransactions.create({
      walletId: wallet.id,
      idempotencyKey: `PAYOUT_REFUND_${payout.id}`,
      type: WalletTransactionType.REFUND,
      direction: 'CREDIT',
      amount: Number(payout.amount),
      balanceBefore,
      balanceAfter,
      status: 'SETTLED',
      description: `Refund for rejected payout request: ${failureReason}`,
      metadata: { payoutId, failureReason }
    });

    const updated = await db.payouts.update(payoutId, {
      status: PayoutStatus.REJECTED,
      failureReason,
      settledAt: new Date()
    });

    return updated;
  }

  public async getDriverPayouts(driverId: string) {
    return db.payouts.findByDriverId(driverId);
  }

  public async getPendingPayouts() {
    const pending = await db.payouts.listPending();
    return Promise.all(pending.map(async (p) => {
      const driver = await db.driverProfiles.findById(p.driverId);
      const user = driver ? await db.users.findById(driver.userId) : null;
      return {
        ...p,
        driver: driver && user ? {
          name: user.name,
          phone: user.phone,
          upiId: driver.upiId,
          bankAccount: driver.bankAccountNumber,
          ifsc: driver.bankIfscCode
        } : null
      };
    }));
  }
}

export const financeService = new FinanceService();
