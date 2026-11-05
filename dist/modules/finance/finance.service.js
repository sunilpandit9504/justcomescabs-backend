"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeService = exports.FinanceService = void 0;
const db_js_1 = require("../../services/db.js");
const socket_service_js_1 = require("../socket/socket.service.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const logger_js_1 = require("../../common/logger.js");
class FinanceService {
    /**
     * Settles the frozen CommissionAgreement when a shared booking completes
     */
    async settleSharedBookingCommission(bookingId) {
        const agreement = await db_js_1.db.commissionAgreements.findByBookingId(bookingId);
        if (!agreement) {
            logger_js_1.logger.warn(`No commission agreement found for booking ${bookingId}`);
            return null;
        }
        if (agreement.settlementStatus === 'SETTLED') {
            logger_js_1.logger.info(`Commission for booking ${bookingId} already settled (Idempotent bypass)`);
            return agreement;
        }
        const booking = await db_js_1.db.bookings.findById(bookingId);
        if (!booking)
            throw new errors_js_1.NotFoundError('Booking not found');
        const creatorDriver = await db_js_1.db.driverProfiles.findById(agreement.creatorDriverId);
        if (!creatorDriver)
            throw new errors_js_1.NotFoundError('Creator driver not found');
        const creatorUser = await db_js_1.db.users.findById(creatorDriver.userId);
        if (!creatorUser)
            throw new errors_js_1.NotFoundError('Creator user not found');
        const commissionAmount = Number(agreement.creatorCommissionAmount);
        // 1. Credit Driver A Wallet with unique idempotency key
        const idempotencyKey = `COMMISSION_SETTLE_${bookingId}_${agreement.id}`;
        const creatorWallet = await db_js_1.db.wallets.findByUserId(creatorUser.id);
        const { balanceBefore, balanceAfter } = await db_js_1.db.wallets.updateBalance(creatorWallet.id, commissionAmount, 'CREDIT');
        await db_js_1.db.walletTransactions.create({
            walletId: creatorWallet.id,
            idempotencyKey,
            referenceBookingId: bookingId,
            type: shared_1.WalletTransactionType.COMMISSION_EARNING,
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
            const assignedDriver = await db_js_1.db.driverProfiles.findById(agreement.assignedDriverId);
            if (assignedDriver) {
                const assignedUser = await db_js_1.db.users.findById(assignedDriver.userId);
                if (assignedUser) {
                    const driverBWallet = await db_js_1.db.wallets.findByUserId(assignedUser.id);
                    const { balanceBefore: bBefore, balanceAfter: bAfter } = await db_js_1.db.wallets.updateBalance(driverBWallet.id, platformFee, 'DEBIT');
                    await db_js_1.db.walletTransactions.create({
                        walletId: driverBWallet.id,
                        idempotencyKey: `PLATFORM_FEE_${bookingId}_${agreement.id}`,
                        referenceBookingId: bookingId,
                        type: shared_1.WalletTransactionType.PLATFORM_FEE_DEDUCTION,
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
                    logger_js_1.logger.info(`Admin Platform Fee: ₹${platformFee} deducted from Driver B (${assignedUser.name}) for trip ${booking.bookingCode}`);
                }
            }
        }
        // 3. Mark CommissionAgreement as SETTLED
        const updatedAgreement = await db_js_1.db.commissionAgreements.update(agreement.id, {
            settlementStatus: 'SETTLED',
            settledAt: new Date()
        });
        // 3. Emit real-time notification to Driver A
        socket_service_js_1.socketService.emitCommissionCredited(creatorDriver.id, {
            bookingId,
            bookingCode: booking.bookingCode,
            amount: commissionAmount,
            newWalletBalance: balanceAfter,
            settledAt: new Date()
        });
        logger_js_1.logger.info(`Commission settled: ₹${commissionAmount} credited to Driver A (${creatorUser.name}) for booking ${booking.bookingCode}`);
        return updatedAgreement;
    }
    /**
     * Gets user wallet balance & status
     */
    async getWallet(userId) {
        const wallet = await db_js_1.db.wallets.findByUserId(userId);
        return wallet;
    }
    /**
     * Gets paginated transaction ledger
     */
    async getWalletTransactions(userId) {
        const wallet = await db_js_1.db.wallets.findByUserId(userId);
        const transactions = await db_js_1.db.walletTransactions.findByWalletId(wallet.id);
        return transactions;
    }
    /**
     * Driver requests payout withdrawal
     */
    async requestPayout(driverId, amount, payoutChannel = 'UPI_TRANSFER', upiId) {
        if (amount <= 0) {
            throw new errors_js_1.BadRequestError('Payout amount must be greater than zero');
        }
        const driver = await db_js_1.db.driverProfiles.findById(driverId);
        if (!driver)
            throw new errors_js_1.NotFoundError('Driver profile not found');
        const wallet = await db_js_1.db.wallets.findByUserId(driver.userId);
        if (Number(wallet.balance) < amount) {
            throw new errors_js_1.BadRequestError(`Insufficient wallet balance. Available: ₹${wallet.balance}, Requested: ₹${amount}`);
        }
        // Debit available wallet balance
        const { balanceBefore, balanceAfter } = await db_js_1.db.wallets.updateBalance(wallet.id, amount, 'DEBIT');
        const payout = await db_js_1.db.payouts.create({
            driverId,
            amount,
            status: shared_1.PayoutStatus.REQUESTED,
            payoutChannel,
            bankReferenceId: upiId || driver.upiId || 'Pending processing'
        });
        await db_js_1.db.walletTransactions.create({
            walletId: wallet.id,
            idempotencyKey: `PAYOUT_REQ_${payout.id}`,
            type: shared_1.WalletTransactionType.PAYOUT_WITHDRAWAL,
            direction: 'DEBIT',
            amount,
            balanceBefore,
            balanceAfter,
            status: 'PENDING',
            description: `Withdrawal request via ${payoutChannel} (Payout ID: ${payout.id.substring(0, 8)}...)`,
            metadata: { payoutId: payout.id, upiId: upiId || driver.upiId }
        });
        logger_js_1.logger.info(`Payout requested: ₹${amount} by Driver ${driverId}`);
        return payout;
    }
    /**
     * Admin approves and finalizes payout
     */
    async approvePayout(payoutId, adminId, bankReferenceId) {
        const payout = (await db_js_1.db.payouts.listPending()).find(p => p.id === payoutId);
        if (!payout) {
            throw new errors_js_1.NotFoundError('Pending payout request not found');
        }
        const updated = await db_js_1.db.payouts.update(payoutId, {
            status: shared_1.PayoutStatus.COMPLETED,
            bankReferenceId: bankReferenceId || `UPI-TXN-${Date.now()}`,
            settledAt: new Date()
        });
        await db_js_1.db.auditLogs.create({
            actorId: adminId,
            action: 'PAYOUT_APPROVED',
            entityType: 'PAYOUT',
            entityId: payoutId,
            changes: { amount: payout.amount, bankReferenceId }
        });
        logger_js_1.logger.info(`Payout approved: ID ${payoutId} for ₹${payout.amount} (Ref: ${bankReferenceId})`);
        return updated;
    }
    /**
     * Admin rejects payout and returns funds to driver wallet
     */
    async rejectPayout(payoutId, adminId, failureReason) {
        const payout = (await db_js_1.db.payouts.listPending()).find(p => p.id === payoutId);
        if (!payout) {
            throw new errors_js_1.NotFoundError('Pending payout request not found');
        }
        const driver = await db_js_1.db.driverProfiles.findById(payout.driverId);
        if (!driver)
            throw new errors_js_1.NotFoundError('Driver not found');
        const wallet = await db_js_1.db.wallets.findByUserId(driver.userId);
        // Refund amount back to driver wallet
        const { balanceBefore, balanceAfter } = await db_js_1.db.wallets.updateBalance(wallet.id, Number(payout.amount), 'CREDIT');
        await db_js_1.db.walletTransactions.create({
            walletId: wallet.id,
            idempotencyKey: `PAYOUT_REFUND_${payout.id}`,
            type: shared_1.WalletTransactionType.REFUND,
            direction: 'CREDIT',
            amount: Number(payout.amount),
            balanceBefore,
            balanceAfter,
            status: 'SETTLED',
            description: `Refund for rejected payout request: ${failureReason}`,
            metadata: { payoutId, failureReason }
        });
        const updated = await db_js_1.db.payouts.update(payoutId, {
            status: shared_1.PayoutStatus.REJECTED,
            failureReason,
            settledAt: new Date()
        });
        return updated;
    }
    async getDriverPayouts(driverId) {
        return db_js_1.db.payouts.findByDriverId(driverId);
    }
    async getPendingPayouts() {
        const pending = await db_js_1.db.payouts.listPending();
        return Promise.all(pending.map(async (p) => {
            const driver = await db_js_1.db.driverProfiles.findById(p.driverId);
            const user = driver ? await db_js_1.db.users.findById(driver.userId) : null;
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
    /**
     * Admin directly adjusts (CREDIT or DEBIT) a driver's wallet balance
     */
    async adjustDriverWallet(driverId, action, amount, adminId, reason) {
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new errors_js_1.BadRequestError('Amount must be a positive number greater than 0');
        }
        const cleanId = driverId.replace('#', '').trim();
        let driver = await db_js_1.db.driverProfiles.findById(cleanId);
        if (!driver) {
            const all = await db_js_1.db.driverProfiles.listAll();
            driver = all.find(d => d.id === cleanId || d.userId === cleanId || d.id.toLowerCase().endsWith(cleanId.toLowerCase()));
        }
        if (!driver) {
            throw new errors_js_1.NotFoundError(`Driver profile not found for ID: ${driverId}`);
        }
        let wallet = await db_js_1.db.wallets.findByUserId(driver.userId);
        if (!wallet) {
            // Auto-create wallet if not present
            wallet = await db_js_1.db.wallets.create({
                userId: driver.userId,
                balance: 0,
                lockedBalance: 0,
                currency: 'INR',
                isFrozen: false
            });
        }
        const currentBal = Number(wallet.balance || 0);
        if (action === 'DEBIT' && currentBal < numAmount) {
            throw new errors_js_1.BadRequestError(`Cannot debit ₹${numAmount.toFixed(2)}. Available balance is only ₹${currentBal.toFixed(2)}`);
        }
        const { balanceBefore, balanceAfter } = await db_js_1.db.wallets.updateBalance(wallet.id, numAmount, action);
        const idempotencyKey = `ADMIN_ADJUST_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const transaction = await db_js_1.db.walletTransactions.create({
            walletId: wallet.id,
            idempotencyKey,
            type: action === 'CREDIT' ? shared_1.WalletTransactionType.TOPUP : shared_1.WalletTransactionType.DISPUTE_ADJUSTMENT,
            direction: action,
            amount: numAmount,
            balanceBefore,
            balanceAfter,
            status: 'SETTLED',
            description: `Admin ${action}: ${reason || 'Manual balance adjustment'}`,
            metadata: { adminId, reason, action, driverId: driver.id }
        });
        try {
            await db_js_1.db.auditLogs.create({
                actorId: adminId,
                action: `DRIVER_WALLET_${action}`,
                entityType: 'WALLET',
                entityId: wallet.id,
                changes: { driverId: driver.id, amount: numAmount, action, balanceBefore, balanceAfter, reason }
            });
        }
        catch (_) { }
        logger_js_1.logger.info(`Admin ${adminId} adjusted Driver ${driver.id} wallet (${action} ₹${numAmount}) -> New Balance: ₹${balanceAfter}`);
        return {
            success: true,
            driverId: driver.id,
            driverName: (await db_js_1.db.users.findById(driver.userId))?.name || 'Driver',
            action,
            amount: numAmount,
            balanceBefore,
            balanceAfter,
            transaction
        };
    }
    async getDriverWalletHistory(driverId) {
        const cleanId = driverId.replace('#', '').trim();
        let driver = await db_js_1.db.driverProfiles.findById(cleanId);
        if (!driver) {
            const all = await db_js_1.db.driverProfiles.listAll();
            driver = all.find(d => d.id === cleanId || d.userId === cleanId || d.id.toLowerCase().endsWith(cleanId.toLowerCase()));
        }
        if (!driver)
            throw new errors_js_1.NotFoundError(`Driver profile not found for ID: ${driverId}`);
        const wallet = await db_js_1.db.wallets.findByUserId(driver.userId);
        if (!wallet)
            return { balance: 0, transactions: [] };
        const transactions = await db_js_1.db.walletTransactions.findByWalletId(wallet.id);
        return {
            walletId: wallet.id,
            balance: Number(wallet.balance || 0),
            currency: wallet.currency || 'INR',
            transactions: transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        };
    }
}
exports.FinanceService = FinanceService;
exports.financeService = new FinanceService();
