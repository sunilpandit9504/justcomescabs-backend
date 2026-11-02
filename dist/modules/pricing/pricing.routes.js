"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pricing_service_js_1 = require("./pricing.service.js");
const errors_js_1 = require("../../common/errors.js");
const router = (0, express_1.Router)();
router.post('/estimate', async (req, res, next) => {
    try {
        const { pickup, destination, isOutstation = false } = req.body;
        if (!pickup || pickup.latitude === undefined || pickup.longitude === undefined) {
            throw new errors_js_1.BadRequestError('Valid pickup coordinates are required');
        }
        if (!destination || destination.latitude === undefined || destination.longitude === undefined) {
            throw new errors_js_1.BadRequestError('Valid destination coordinates are required');
        }
        const estimates = pricing_service_js_1.pricingService.getFareEstimates(pickup, destination, Boolean(isOutstation));
        res.json({
            success: true,
            data: estimates
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
