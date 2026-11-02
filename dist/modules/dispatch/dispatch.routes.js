"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dispatch_service_js_1 = require("./dispatch.service.js");
const auth_js_1 = require("../../common/middleware/auth.js");
const shared_1 = require("@gatigo/shared");
const errors_js_1 = require("../../common/errors.js");
const router = (0, express_1.Router)();
// Driver accepts booking
router.post('/bookings/:id/accept', auth_js_1.authenticateToken, (0, auth_js_1.requireRoles)(shared_1.UserRole.DRIVER), async (req, res, next) => {
    try {
        if (!req.user.driverId) {
            throw new errors_js_1.BadRequestError('Driver profile not linked to user');
        }
        const updated = await dispatch_service_js_1.dispatchService.acceptBooking(req.params.id, req.user.driverId);
        res.json({
            success: true,
            message: 'Ride successfully accepted and assigned to you',
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
