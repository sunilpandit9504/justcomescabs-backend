"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingService = exports.PricingService = void 0;
const shared_1 = require("@gatigo/shared");
const FARE_RULES = {
    [shared_1.VehicleCategory.BIKE]: {
        baseFare: 25,
        minDistanceKm: 1.5,
        perKmRate: 9,
        perMinuteRate: 1.0,
        minimumFare: 30,
        seatingCapacity: 1,
        label: 'Gati Bike',
        description: 'Fastest single ride through traffic'
    },
    [shared_1.VehicleCategory.AUTO]: {
        baseFare: 40,
        minDistanceKm: 2.0,
        perKmRate: 14,
        perMinuteRate: 1.5,
        minimumFare: 50,
        seatingCapacity: 3,
        label: 'Gati Auto',
        description: 'Pocket-friendly 3-seater auto'
    },
    [shared_1.VehicleCategory.MINI]: {
        baseFare: 60,
        minDistanceKm: 2.5,
        perKmRate: 18,
        perMinuteRate: 2.0,
        minimumFare: 80,
        seatingCapacity: 4,
        label: 'Gati Mini',
        description: 'Affordable compact AC hatchback'
    },
    [shared_1.VehicleCategory.HATCHBACK]: {
        baseFare: 70,
        minDistanceKm: 3.0,
        perKmRate: 20,
        perMinuteRate: 2.0,
        minimumFare: 90,
        seatingCapacity: 4,
        label: 'Gati Go',
        description: 'Comfortable everyday AC hatchback'
    },
    [shared_1.VehicleCategory.SEDAN]: {
        baseFare: 90,
        minDistanceKm: 3.0,
        perKmRate: 24,
        perMinuteRate: 2.5,
        minimumFare: 120,
        seatingCapacity: 4,
        label: 'Gati Premier Sedan',
        description: 'Spacious sedan (Dzire, Aura) with top drivers'
    },
    [shared_1.VehicleCategory.SUV]: {
        baseFare: 150,
        minDistanceKm: 4.0,
        perKmRate: 32,
        perMinuteRate: 3.0,
        minimumFare: 200,
        seatingCapacity: 6,
        label: 'Gati XL SUV',
        description: '6-7 seater for families & extra luggage'
    },
    [shared_1.VehicleCategory.PREMIUM]: {
        baseFare: 180,
        minDistanceKm: 4.0,
        perKmRate: 38,
        perMinuteRate: 3.5,
        minimumFare: 250,
        seatingCapacity: 4,
        label: 'Gati Executive',
        description: 'Luxury sedan for business travel'
    },
    [shared_1.VehicleCategory.OUTSTATION]: {
        baseFare: 500,
        minDistanceKm: 50.0,
        perKmRate: 14,
        perMinuteRate: 0,
        minimumFare: 1200,
        seatingCapacity: 4,
        label: 'Gati Intercity Outstation',
        description: 'Reliable one-way or round trips between cities'
    }
};
class PricingService {
    /**
     * Calculates Haversine distance in KM with standard road tortuosity adjustment
     */
    calculateDistanceKm(pickup, dropoff) {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(dropoff.latitude - pickup.latitude);
        const dLon = this.deg2rad(dropoff.longitude - pickup.longitude);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(pickup.latitude)) * Math.cos(this.deg2rad(dropoff.latitude)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const straightDistance = R * c;
        // Apply road routing tortuosity factor (typically 1.25 - 1.3x for Indian roads)
        const roadDistance = straightDistance * 1.28;
        return Math.max(0.5, Math.round(roadDistance * 10) / 10);
    }
    /**
     * Estimates travel duration in minutes based on distance and average city/highway speed
     */
    estimateDurationMinutes(distanceKm, isOutstation = false) {
        // City avg speed ~22 km/h; Outstation ~50 km/h
        const avgSpeedKmh = isOutstation || distanceKm > 35 ? 48 : 22;
        const hours = distanceKm / avgSpeedKmh;
        const minutes = Math.round(hours * 60) + 3; // +3 mins buffer for signals
        return Math.max(5, minutes);
    }
    /**
     * Calculates fare estimate for a single category
     */
    computeFare(category, distanceKm, durationMinutes, surgeMultiplier = 1.0) {
        const rule = FARE_RULES[category] || FARE_RULES[shared_1.VehicleCategory.SEDAN];
        const billableKm = Math.max(0, distanceKm - rule.minDistanceKm);
        const distanceFare = billableKm * rule.perKmRate;
        const timeFare = durationMinutes * rule.perMinuteRate;
        const rawFare = rule.baseFare + distanceFare + timeFare;
        const surgedFare = rawFare * surgeMultiplier;
        const finalFare = Math.max(rule.minimumFare, Math.round(surgedFare));
        return finalFare;
    }
    /**
     * Generates all available vehicle category fare options
     */
    getFareEstimates(pickup, dropoff, isOutstation = false) {
        const distanceKm = this.calculateDistanceKm(pickup, dropoff);
        const durationMinutes = this.estimateDurationMinutes(distanceKm, isOutstation);
        const categoriesToReturn = isOutstation || distanceKm >= 40
            ? [shared_1.VehicleCategory.SEDAN, shared_1.VehicleCategory.SUV, shared_1.VehicleCategory.OUTSTATION]
            : [
                shared_1.VehicleCategory.BIKE,
                shared_1.VehicleCategory.AUTO,
                shared_1.VehicleCategory.HATCHBACK,
                shared_1.VehicleCategory.SEDAN,
                shared_1.VehicleCategory.SUV
            ];
        return categoriesToReturn.map((cat) => {
            const rule = FARE_RULES[cat];
            const estimatedFare = this.computeFare(cat, distanceKm, durationMinutes);
            return {
                category: cat,
                categoryLabel: rule.label,
                categoryDescription: rule.description,
                seatingCapacity: rule.seatingCapacity,
                baseFare: rule.baseFare,
                estimatedFare,
                distanceKm,
                durationMinutes,
                perKmRate: rule.perKmRate,
                icon: this.getCategoryIcon(cat)
            };
        });
    }
    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
    getCategoryIcon(cat) {
        switch (cat) {
            case shared_1.VehicleCategory.BIKE: return 'motorcycle';
            case shared_1.VehicleCategory.AUTO: return 'auto-rickshaw';
            case shared_1.VehicleCategory.HATCHBACK: return 'car-hatchback';
            case shared_1.VehicleCategory.SEDAN: return 'car-sedan';
            case shared_1.VehicleCategory.SUV: return 'car-suv';
            case shared_1.VehicleCategory.OUTSTATION: return 'car-outstation';
            default: return 'car';
        }
    }
}
exports.PricingService = PricingService;
exports.pricingService = new PricingService();
