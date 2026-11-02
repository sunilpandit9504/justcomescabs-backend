"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const db_js_1 = require("../../services/db.js");
const errors_js_1 = require("../../common/errors.js");
const router = (0, express_1.Router)();
// Get customer profile
router.get('/profile', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER, shared_1.UserRole.SUPER_ADMIN), async (req, res, next) => {
    try {
        const user = await db_js_1.db.users.findById(req.user.id);
        const profile = await db_js_1.db.customerProfiles.findByUserId(req.user.id);
        const addresses = profile ? await db_js_1.db.savedAddresses.findByCustomerId(profile.id) : [];
        res.json({
            success: true,
            data: {
                user,
                profile,
                savedAddresses: addresses
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// Update customer profile
router.put('/profile', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER), async (req, res, next) => {
    try {
        const { name, emergencyContactName, emergencyContactPhone, preferredLanguage } = req.body;
        if (name || preferredLanguage) {
            await db_js_1.db.users.update(req.user.id, {
                ...(name ? { name } : {}),
                ...(preferredLanguage ? { preferredLanguage } : {})
            });
        }
        if (req.user.customerId && (emergencyContactName || emergencyContactPhone)) {
            await db_js_1.db.customerProfiles.update(req.user.customerId, {
                emergencyContactName,
                emergencyContactPhone
            });
        }
        const updatedUser = await db_js_1.db.users.findById(req.user.id);
        const updatedProfile = req.user.customerId ? await db_js_1.db.customerProfiles.findById(req.user.customerId) : null;
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user: updatedUser, profile: updatedProfile }
        });
    }
    catch (err) {
        next(err);
    }
});
// Saved addresses
router.get('/saved-addresses', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER), async (req, res, next) => {
    try {
        if (!req.user.customerId) {
            return res.json({ success: true, data: [] });
        }
        const addresses = await db_js_1.db.savedAddresses.findByCustomerId(req.user.customerId);
        res.json({ success: true, data: addresses });
    }
    catch (err) {
        next(err);
    }
});
router.post('/saved-addresses', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER), async (req, res, next) => {
    try {
        const { label, address, latitude, longitude } = req.body;
        if (!label || !address || latitude === undefined || longitude === undefined) {
            throw new errors_js_1.BadRequestError('Label, address, latitude, and longitude are required');
        }
        if (!req.user.customerId) {
            throw new errors_js_1.BadRequestError('Customer profile not initialized');
        }
        const saved = await db_js_1.db.savedAddresses.create({
            customerId: req.user.customerId,
            label,
            address,
            latitude,
            longitude
        });
        res.status(201).json({
            success: true,
            message: 'Address saved successfully',
            data: saved
        });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/saved-addresses/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.CUSTOMER), async (req, res, next) => {
    try {
        await db_js_1.db.savedAddresses.delete(req.params.id);
        res.json({ success: true, message: 'Address removed successfully' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
