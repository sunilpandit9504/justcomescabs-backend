"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const finance_service_js_1 = require("./finance.service.js");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const db_js_1 = require("../../services/db.js");
const router = (0, express_1.Router)();
// Get authenticated user's wallet
router.get('/', auth_js_1.authenticateToken, async (req, res, next) => {
    try {
        const wallet = await finance_service_js_1.financeService.getWallet(req.user.id);
        res.json({
            success: true,
            data: wallet
        });
    }
    catch (err) {
        next(err);
    }
});
// Get wallet transaction ledger
router.get('/transactions', auth_js_1.authenticateToken, async (req, res, next) => {
    try {
        const transactions = await finance_service_js_1.financeService.getWalletTransactions(req.user.id);
        res.json({
            success: true,
            data: transactions
        });
    }
    catch (err) {
        next(err);
    }
});
// Top up wallet balance
router.post('/topup', auth_js_1.authenticateToken, async (req, res, next) => {
    try {
        const { amount = 1000 } = req.body;
        const wallet = await db_js_1.db.wallets.findByUserId(req.user.id);
        const { balanceAfter } = await db_js_1.db.wallets.updateBalance(wallet.id, Number(amount), 'CREDIT');
        res.json({
            success: true,
            message: 'Wallet balance updated',
            data: { balance: balanceAfter }
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver requests payout withdrawal
router.post('/payouts/request', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const { amount, payoutChannel = 'UPI_TRANSFER', upiId } = req.body;
        if (!amount) {
            throw new errors_js_1.BadRequestError('Withdrawal amount is required');
        }
        const payout = await finance_service_js_1.financeService.requestPayout(req.user.driverId, Number(amount), payoutChannel, upiId);
        res.status(201).json({
            success: true,
            message: 'Payout withdrawal requested successfully',
            data: payout
        });
    }
    catch (err) {
        next(err);
    }
});
// Driver views payout withdrawal requests
router.get('/payouts', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        const payouts = await finance_service_js_1.financeService.getDriverPayouts(req.user.driverId);
        res.json({
            success: true,
            data: payouts
        });
    }
    catch (err) {
        next(err);
    }
});
// Admin views pending payouts
router.get('/admin/pending', auth_js_1.authenticateToken, auth_js_1.requireAdmin, async (req, res, next) => {
    try {
        const pending = await finance_service_js_1.financeService.getPendingPayouts();
        res.json({
            success: true,
            data: pending
        });
    }
    catch (err) {
        next(err);
    }
});
// Admin approves payout
router.post('/admin/:id/approve', auth_js_1.authenticateToken, auth_js_1.requireAdmin, async (req, res, next) => {
    try {
        const { bankReferenceId } = req.body;
        const result = await finance_service_js_1.financeService.approvePayout(req.params.id, req.user.id, bankReferenceId);
        res.json({
            success: true,
            message: 'Payout approved and settled',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
// Admin rejects payout
router.post('/admin/:id/reject', auth_js_1.authenticateToken, auth_js_1.requireAdmin, async (req, res, next) => {
    try {
        const { reason = 'Rejected by admin' } = req.body;
        const result = await finance_service_js_1.financeService.rejectPayout(req.params.id, req.user.id, reason);
        res.json({
            success: true,
            message: 'Payout rejected and refunded back to driver wallet',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
