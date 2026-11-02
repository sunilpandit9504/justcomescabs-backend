"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_js_1 = require("../../config/index.js");
const logger_js_1 = require("../../common/logger.js");
const shared_1 = require("@gatigo/shared");
class SocketService {
    io = null;
    connectedSockets = new Map();
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: index_js_1.config.cors.origins,
                methods: ['GET', 'POST'],
                credentials: true
            }
        });
        // JWT Authentication middleware for Socket connections
        this.io.use((socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
            if (!token) {
                logger_js_1.logger.warn('Socket connection rejected: Missing token');
                return next(new Error('Authentication required'));
            }
            try {
                const decoded = jsonwebtoken_1.default.verify(token, index_js_1.config.jwt.secret);
                socket.user = decoded;
                next();
            }
            catch (err) {
                logger_js_1.logger.warn('Socket connection rejected: Invalid token');
                next(new Error('Invalid token'));
            }
        });
        this.io.on('connection', (socket) => {
            const user = socket.user;
            logger_js_1.logger.info(`Socket client connected: ${user.phone} (${user.role}) [SocketID: ${socket.id}]`);
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
            socket.on(shared_1.WS_EVENTS.DRIVER_LOCATION_EMIT, (telemetry) => {
                if (user.driverId) {
                    // Broadcast to anyone tracking this driver
                    this.broadcastDriverLocation(telemetry);
                }
            });
            socket.on('disconnect', () => {
                logger_js_1.logger.info(`Socket client disconnected: ${user.phone}`);
                this.connectedSockets.delete(socket.id);
            });
        });
        logger_js_1.logger.info('Real-time Socket.IO gateway initialized');
    }
    notifyDriverDutyStatus(driverId, isOnline) {
        if (!this.io)
            return;
        this.io.emit('driver.duty_status', { driverId, isOnline });
    }
    broadcastDriverLocation(telemetry) {
        if (!this.io)
            return;
        this.io.emit(shared_1.WS_EVENTS.DRIVER_LOCATION_BROADCAST, telemetry);
        // Also emit to targeted tracking room
        this.io.to(`track:driver:${telemetry.driverId}`).emit(shared_1.WS_EVENTS.DRIVER_LOCATION_BROADCAST, telemetry);
    }
    emitRideShareOffer(offerData) {
        if (!this.io)
            return;
        logger_js_1.logger.info(`Emitting offline ride share offer: ${offerData.bookingCode}`);
        this.io.emit(shared_1.WS_EVENTS.RIDE_SHARE_OFFERED, offerData);
    }
    emitRideShareAccepted(creatorDriverId, payload) {
        if (!this.io)
            return;
        logger_js_1.logger.info(`Emitting ride share accepted to Driver A (${creatorDriverId})`);
        this.io.to(`driver:${creatorDriverId}`).emit(shared_1.WS_EVENTS.RIDE_SHARE_ACCEPTED, payload);
    }
    emitCommissionCredited(creatorDriverId, payload) {
        if (!this.io)
            return;
        this.io.to(`driver:${creatorDriverId}`).emit(shared_1.WS_EVENTS.COMMISSION_CREDITED, payload);
    }
    emitBookingStatusUpdated(bookingId, status, payload) {
        if (!this.io)
            return;
        this.io.to(`booking:${bookingId}`).emit(shared_1.WS_EVENTS.RIDE_STATUS_UPDATED, { bookingId, status, ...payload });
        this.io.emit(shared_1.WS_EVENTS.RIDE_STATUS_UPDATED, { bookingId, status, ...payload });
    }
}
exports.SocketService = SocketService;
exports.socketService = new SocketService();
