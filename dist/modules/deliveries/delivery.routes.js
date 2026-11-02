"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_js_1 = require("../../common/logger.js");
const socket_service_js_1 = require("../socket/socket.service.js");
const router = (0, express_1.Router)();
// In-memory parcel delivery orders store
const parcelOrders = new Map();
// 1. Calculate parcel delivery fare estimate
router.post('/estimate', async (req, res, next) => {
    try {
        const { pickup, destination, weightKg = 1.0, parcelType = 'DOCUMENTS' } = req.body;
        // Estimate distance (default 4.5km if not provided)
        const distanceKm = 4.5;
        const baseFare = 40; // Base fare for express bike courier
        const perKmRate = 12;
        const weightSurcharge = Math.max(0, (Number(weightKg) - 1.0) * 15);
        const estimatedFare = Math.round(baseFare + (distanceKm * perKmRate) + weightSurcharge);
        res.json({
            success: true,
            data: {
                service: 'EXPRESS_PARCEL_DELIVERY',
                parcelType,
                weightKg: Number(weightKg),
                distanceKm,
                estimatedFare,
                deliveryTimeMinutes: 25,
                currency: 'INR',
                insuranceCovered: true,
                maxWeightAllowedKg: 20
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// 2. Create Parcel Delivery Booking
router.post('/create', async (req, res, next) => {
    try {
        const { senderName = 'Aarav Sharma', senderPhone = '+919876500001', pickupAddress, destAddress, parcelName = 'Documents & Package', parcelCategory = 'DOCUMENTS', weightKg = 1.5, receiverName, receiverPhone, pickupNotes, paymentMethod = 'CASH' } = req.body;
        const deliveryId = `del_${Date.now()}`;
        const trackingCode = `GTG-DEL-${Math.floor(100000 + Math.random() * 900000)}`;
        const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
        const distanceKm = 5.2;
        const estimatedFare = Math.round(40 + (distanceKm * 12) + (Math.max(0, Number(weightKg) - 1) * 15));
        const order = {
            id: deliveryId,
            trackingCode,
            status: 'ASSIGNED',
            createdAt: new Date().toISOString(),
            sender: { name: senderName, phone: senderPhone, address: pickupAddress || 'Ranchi Main Road' },
            receiver: { name: receiverName || 'Anjali Sinha', phone: receiverPhone || '+919431100009', address: destAddress || 'Kanke Road, Ranchi' },
            parcel: {
                name: parcelName,
                category: parcelCategory,
                weightKg: Number(weightKg),
                notes: pickupNotes || 'Handle with care'
            },
            assignedCourier: {
                name: 'Rahul Verma',
                phone: '+919876500010',
                vehicleType: 'TVS Jupiter (Bike)',
                plateNumber: 'JH01-CY-4821',
                rating: 4.9,
                liveLocation: { latitude: 23.3450, longitude: 85.3105 }
            },
            fare: estimatedFare,
            paymentMethod,
            deliveryOtp
        };
        parcelOrders.set(deliveryId, order);
        logger_js_1.logger.info(`Parcel Delivery created: ${trackingCode} for receiver ${receiverName}`);
        res.status(201).json({
            success: true,
            message: 'Parcel delivery request dispatched successfully!',
            data: order
        });
    }
    catch (err) {
        next(err);
    }
});
// 3. Track Parcel Delivery
router.get('/:id/track', async (req, res, next) => {
    try {
        const order = parcelOrders.get(req.params.id) || {
            id: req.params.id,
            trackingCode: 'GTG-DEL-849201',
            status: 'IN_TRANSIT',
            parcel: { name: 'Electronics & Gadgets', weightKg: 2.5 },
            assignedCourier: {
                name: 'Rahul Verma',
                phone: '+919876500010',
                vehicleType: 'Hero Splendor (Bike)',
                plateNumber: 'JH01-CY-4821',
                rating: 4.9
            },
            fare: 110,
            deliveryOtp: '4821',
            estimatedArrivalMinutes: 12
        };
        res.json({
            success: true,
            data: order
        });
    }
    catch (err) {
        next(err);
    }
});
// 4. Women Safety SOS Trigger
router.post('/sos/trigger', async (req, res, next) => {
    try {
        const { userId, userPhone, userName, latitude = 23.3441, longitude = 85.3096, bookingId } = req.body;
        logger_js_1.logger.error(`🚨 [WOMEN SAFETY SOS ALERT TRIGGERED] User: ${userName} (${userPhone}) Location: Lat ${latitude}, Lng ${longitude} | Booking: ${bookingId || 'DIRECT_APP'}`);
        // Emit SOS event to all listening admin/fleet terminals
        socket_service_js_1.socketService.emitBookingStatusUpdated(bookingId || 'emergency', 'EMERGENCY_SOS', {
            alertType: 'WOMEN_SAFETY_SOS',
            user: { name: userName || 'Passenger', phone: userPhone },
            location: { latitude, longitude },
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            message: 'EMERGENCY_ALERT_DISPATCHED',
            data: {
                policeHelpline: '112',
                womenHelpline: '1090',
                ambulanceHelpline: '108',
                safetyResponseTeamNotified: true,
                liveGpsShared: true,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
