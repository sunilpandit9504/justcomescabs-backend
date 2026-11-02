"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const error_handler_js_1 = require("./common/middleware/error-handler.js");
// Route imports
const auth_routes_js_1 = __importDefault(require("./modules/auth/auth.routes.js"));
const customer_routes_js_1 = __importDefault(require("./modules/customer/customer.routes.js"));
const driver_routes_js_1 = __importDefault(require("./modules/driver/driver.routes.js"));
const admin_routes_js_1 = __importDefault(require("./modules/admin/admin.routes.js"));
const pricing_routes_js_1 = __importDefault(require("./modules/pricing/pricing.routes.js"));
const booking_routes_js_1 = __importDefault(require("./modules/bookings/booking.routes.js"));
const dispatch_routes_js_1 = __importDefault(require("./modules/dispatch/dispatch.routes.js"));
const ride_routes_js_1 = __importDefault(require("./modules/rides/ride.routes.js"));
const offline_booking_routes_js_1 = __importDefault(require("./modules/offline-bookings/offline-booking.routes.js"));
const ride_sharing_routes_js_1 = __importDefault(require("./modules/ride-sharing/ride-sharing.routes.js"));
const finance_routes_js_1 = __importDefault(require("./modules/finance/finance.routes.js"));
const delivery_routes_js_1 = __importDefault(require("./modules/deliveries/delivery.routes.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function createApp() {
    const app = (0, express_1.default)();
    // Static files for direct mobile APK downloads with proper Android MIME type
    app.get('/downloads/:filename', (req, res) => {
        const filename = req.params.filename;
        const candidates = [
            path_1.default.resolve(process.cwd(), 'public/downloads', filename),
            path_1.default.resolve(__dirname, '../public/downloads', filename),
            path_1.default.resolve(__dirname, '../../public/downloads', filename),
            path_1.default.resolve(__dirname, '../../admin-dashboard/public/downloads', filename),
            path_1.default.resolve(__dirname, '../../../admin-dashboard/public/downloads', filename)
        ];
        const foundPath = candidates.find(p => fs_1.default.existsSync(p));
        if (foundPath) {
            res.setHeader('Content-Type', 'application/vnd.android.package-archive');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.sendFile(foundPath);
        }
        return res.status(404).json({ success: false, message: `APK file ${filename} not found on server.` });
    });
    const candidatesDir = [
        path_1.default.resolve(process.cwd(), 'public/downloads'),
        path_1.default.resolve(__dirname, '../public/downloads'),
        path_1.default.resolve(__dirname, '../../admin-dashboard/public/downloads')
    ];
    const activeDir = candidatesDir.find(d => fs_1.default.existsSync(d));
    if (activeDir) {
        app.use('/downloads', express_1.default.static(activeDir));
    }
    // Global middlewares
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false // Allow modern frontend dev tools
    }));
    app.use((0, cors_1.default)({
        origin: '*',
        credentials: true
    }));
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, morgan_1.default)('dev'));
    // Health check
    app.get('/health', (req, res) => {
        res.json({
            status: 'HEALTHY',
            service: 'GatiGo Mobility Shared Backend',
            version: '1.0.0',
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        });
    });
    // API v1 routes
    app.use('/api/v1/auth', auth_routes_js_1.default);
    app.use('/api/v1/customers', customer_routes_js_1.default);
    app.use('/api/v1/drivers', driver_routes_js_1.default);
    app.use('/api/v1/admin', admin_routes_js_1.default);
    app.use('/api/v1/pricing', pricing_routes_js_1.default);
    app.use('/api/v1/bookings', booking_routes_js_1.default);
    app.use('/api/v1/dispatch', dispatch_routes_js_1.default);
    app.use('/api/v1/rides', ride_routes_js_1.default);
    app.use('/api/v1/offline-bookings', offline_booking_routes_js_1.default);
    app.use('/api/v1/ride-sharing', ride_sharing_routes_js_1.default);
    app.use('/api/v1/wallet', finance_routes_js_1.default);
    app.use('/api/v1/deliveries', delivery_routes_js_1.default);
    // Public zones endpoint for passenger and driver app clients
    app.get('/api/v1/zones', async (req, res, next) => {
        try {
            const { db } = await import('./services/db.js');
            const zones = await db.zones.listAll();
            res.json({ success: true, data: zones });
        }
        catch (err) {
            next(err);
        }
    });
    // Public vehicle models & service type catalog endpoint
    app.get('/api/v1/vehicle-models', async (req, res, next) => {
        try {
            const { db } = await import('./services/db.js');
            const models = await db.vehicleModels.listAll();
            res.json({ success: true, data: models });
        }
        catch (err) {
            next(err);
        }
    });
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            statusCode: 404,
            error: 'ROUTE_NOT_FOUND',
            message: `Cannot ${req.method} ${req.path}`,
            timestamp: new Date().toISOString()
        });
    });
    // Global error handler
    app.use(error_handler_js_1.errorHandler);
    return app;
}
