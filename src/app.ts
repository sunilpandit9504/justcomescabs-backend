import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { errorHandler } from './common/middleware/error-handler.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import customerRoutes from './modules/customer/customer.routes.js';
import driverRoutes from './modules/driver/driver.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import pricingRoutes from './modules/pricing/pricing.routes.js';
import bookingRoutes from './modules/bookings/booking.routes.js';
import dispatchRoutes from './modules/dispatch/dispatch.routes.js';
import rideRoutes from './modules/rides/ride.routes.js';
import offlineBookingRoutes from './modules/offline-bookings/offline-booking.routes.js';
import rideSharingRoutes from './modules/ride-sharing/ride-sharing.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import deliveryRoutes from './modules/deliveries/delivery.routes.js';

import path from 'path';

export function createApp(): Express {
  const app = express();

  // Static files for direct mobile APK downloads with proper Android MIME type
  app.get('/downloads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.resolve(__dirname, '../../admin-dashboard/public/downloads', filename);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  });
  const downloadsDir = path.resolve(__dirname, '../../admin-dashboard/public/downloads');
  app.use('/downloads', express.static(downloadsDir));

  // Global middlewares
  app.use(helmet({
    contentSecurityPolicy: false // Allow modern frontend dev tools
  }));
  app.use(cors({
    origin: '*',
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

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
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/drivers', driverRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/pricing', pricingRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/dispatch', dispatchRoutes);
  app.use('/api/v1/rides', rideRoutes);
  app.use('/api/v1/offline-bookings', offlineBookingRoutes);
  app.use('/api/v1/ride-sharing', rideSharingRoutes);
  app.use('/api/v1/wallet', financeRoutes);
  app.use('/api/v1/deliveries', deliveryRoutes);

  // Public zones endpoint for passenger and driver app clients
  app.get('/api/v1/zones', async (req, res, next) => {
    try {
      const { db } = await import('./services/db.js');
      const zones = await db.zones.listAll();
      res.json({ success: true, data: zones });
    } catch (err) {
      next(err);
    }
  });

  // Public vehicle models & service type catalog endpoint
  app.get('/api/v1/vehicle-models', async (req, res, next) => {
    try {
      const { db } = await import('./services/db.js');
      const models = await db.vehicleModels.listAll();
      res.json({ success: true, data: models });
    } catch (err) {
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
  app.use(errorHandler);

  return app;
}
