import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../common/logger.js';
import { WS_EVENTS, DriverTelemetry } from '@gatigo/shared';

export class SocketService {
  private io: SocketIOServer | null = null;
  private connectedSockets = new Map<string, Socket>();

  public initialize(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.origins,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // JWT Authentication middleware for Socket connections
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        logger.warn('Socket connection rejected: Missing token');
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        (socket as any).user = decoded;
        next();
      } catch (err) {
        logger.warn('Socket connection rejected: Invalid token');
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user;
      logger.info(`Socket client connected: ${user.phone} (${user.role}) [SocketID: ${socket.id}]`);
      this.connectedSockets.set(socket.id, socket);

      // Join user specific room
      socket.join(`user:${user.sub}`);

      if (user.driverId) {
        socket.join(`driver:${user.driverId}`);
      }
      if (user.customerId) {
        socket.join(`customer:${user.customerId}`);
      }

      // Handle driver GPS telemetry ping from socket client
      socket.on(WS_EVENTS.DRIVER_LOCATION_EMIT, (telemetry: DriverTelemetry) => {
        if (user.driverId) {
          // Broadcast to anyone tracking this driver
          this.broadcastDriverLocation(telemetry);
        }
      });

      socket.on('disconnect', () => {
        logger.info(`Socket client disconnected: ${user.phone}`);
        this.connectedSockets.delete(socket.id);
      });
    });

    logger.info('Real-time Socket.IO gateway initialized');
  }

  public notifyDriverDutyStatus(driverId: string, isOnline: boolean) {
    if (!this.io) return;
    this.io.emit('driver.duty_status', { driverId, isOnline });
  }

  public broadcastDriverLocation(telemetry: DriverTelemetry) {
    if (!this.io) return;
    this.io.emit(WS_EVENTS.DRIVER_LOCATION_BROADCAST, telemetry);
    // Also emit to targeted tracking room
    this.io.to(`track:driver:${telemetry.driverId}`).emit(WS_EVENTS.DRIVER_LOCATION_BROADCAST, telemetry);
  }

  public emitRideShareOffer(offerData: any) {
    if (!this.io) return;
    logger.info(`Emitting offline ride share offer: ${offerData.bookingCode}`);
    this.io.emit(WS_EVENTS.RIDE_SHARE_OFFERED, offerData);
  }

  public emitRideShareAccepted(creatorDriverId: string, payload: any) {
    if (!this.io) return;
    logger.info(`Emitting ride share accepted to Driver A (${creatorDriverId})`);
    this.io.to(`driver:${creatorDriverId}`).emit(WS_EVENTS.RIDE_SHARE_ACCEPTED, payload);
  }

  public emitCommissionCredited(creatorDriverId: string, payload: any) {
    if (!this.io) return;
    this.io.to(`driver:${creatorDriverId}`).emit(WS_EVENTS.COMMISSION_CREDITED, payload);
  }

  public emitBookingStatusUpdated(bookingId: string, status: string, payload?: any) {
    if (!this.io) return;
    this.io.to(`booking:${bookingId}`).emit(WS_EVENTS.RIDE_STATUS_UPDATED, { bookingId, status, ...payload });
    this.io.emit(WS_EVENTS.RIDE_STATUS_UPDATED, { bookingId, status, ...payload });
  }
}

export const socketService = new SocketService();
