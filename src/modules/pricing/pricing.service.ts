import { VehicleCategory } from '@gatigo/shared';

export interface FareEstimateResult {
  category: VehicleCategory;
  categoryLabel: string;
  categoryDescription: string;
  seatingCapacity: number;
  baseFare: number;
  estimatedFare: number;
  distanceKm: number;
  durationMinutes: number;
  perKmRate: number;
  icon: string;
}

export interface CoordinatesInput {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface FareRuleConfig {
  baseFare: number;
  minDistanceKm: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  seatingCapacity: number;
  label: string;
  description: string;
}

const FARE_RULES: Record<VehicleCategory, FareRuleConfig> = {
  [VehicleCategory.BIKE]: {
    baseFare: 25,
    minDistanceKm: 1.5,
    perKmRate: 9,
    perMinuteRate: 1.0,
    minimumFare: 30,
    seatingCapacity: 1,
    label: 'Gati Bike',
    description: 'Fastest single ride through traffic'
  },
  [VehicleCategory.AUTO]: {
    baseFare: 40,
    minDistanceKm: 2.0,
    perKmRate: 14,
    perMinuteRate: 1.5,
    minimumFare: 50,
    seatingCapacity: 3,
    label: 'Gati Auto',
    description: 'Pocket-friendly 3-seater auto'
  },
  [VehicleCategory.MINI]: {
    baseFare: 60,
    minDistanceKm: 2.5,
    perKmRate: 18,
    perMinuteRate: 2.0,
    minimumFare: 80,
    seatingCapacity: 4,
    label: 'Gati Mini',
    description: 'Affordable compact AC hatchback'
  },
  [VehicleCategory.HATCHBACK]: {
    baseFare: 70,
    minDistanceKm: 3.0,
    perKmRate: 20,
    perMinuteRate: 2.0,
    minimumFare: 90,
    seatingCapacity: 4,
    label: 'Gati Go',
    description: 'Comfortable everyday AC hatchback'
  },
  [VehicleCategory.SEDAN]: {
    baseFare: 90,
    minDistanceKm: 3.0,
    perKmRate: 24,
    perMinuteRate: 2.5,
    minimumFare: 120,
    seatingCapacity: 4,
    label: 'Gati Premier Sedan',
    description: 'Spacious sedan (Dzire, Aura) with top drivers'
  },
  [VehicleCategory.SUV]: {
    baseFare: 150,
    minDistanceKm: 4.0,
    perKmRate: 32,
    perMinuteRate: 3.0,
    minimumFare: 200,
    seatingCapacity: 6,
    label: 'Gati XL SUV',
    description: '6-7 seater for families & extra luggage'
  },
  [VehicleCategory.PREMIUM]: {
    baseFare: 180,
    minDistanceKm: 4.0,
    perKmRate: 38,
    perMinuteRate: 3.5,
    minimumFare: 250,
    seatingCapacity: 4,
    label: 'Gati Executive',
    description: 'Luxury sedan for business travel'
  },
  [VehicleCategory.OUTSTATION]: {
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

export class PricingService {
  /**
   * Calculates Haversine distance in KM with standard road tortuosity adjustment
   */
  public calculateDistanceKm(pickup: CoordinatesInput, dropoff: CoordinatesInput): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(dropoff.latitude - pickup.latitude);
    const dLon = this.deg2rad(dropoff.longitude - pickup.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
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
  public estimateDurationMinutes(distanceKm: number, isOutstation = false): number {
    // City avg speed ~22 km/h; Outstation ~50 km/h
    const avgSpeedKmh = isOutstation || distanceKm > 35 ? 48 : 22;
    const hours = distanceKm / avgSpeedKmh;
    const minutes = Math.round(hours * 60) + 3; // +3 mins buffer for signals
    return Math.max(5, minutes);
  }

  /**
   * Calculates fare estimate for a single category
   */
  public computeFare(category: VehicleCategory, distanceKm: number, durationMinutes: number, surgeMultiplier = 1.0): number {
    const rule = FARE_RULES[category] || FARE_RULES[VehicleCategory.SEDAN];
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
  public getFareEstimates(pickup: CoordinatesInput, dropoff: CoordinatesInput, isOutstation = false): FareEstimateResult[] {
    const distanceKm = this.calculateDistanceKm(pickup, dropoff);
    const durationMinutes = this.estimateDurationMinutes(distanceKm, isOutstation);

    const categoriesToReturn: VehicleCategory[] = isOutstation || distanceKm >= 40
      ? [VehicleCategory.SEDAN, VehicleCategory.SUV, VehicleCategory.OUTSTATION]
      : [
          VehicleCategory.BIKE,
          VehicleCategory.AUTO,
          VehicleCategory.HATCHBACK,
          VehicleCategory.SEDAN,
          VehicleCategory.SUV
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

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private getCategoryIcon(cat: VehicleCategory): string {
    switch (cat) {
      case VehicleCategory.BIKE: return 'motorcycle';
      case VehicleCategory.AUTO: return 'auto-rickshaw';
      case VehicleCategory.HATCHBACK: return 'car-hatchback';
      case VehicleCategory.SEDAN: return 'car-sedan';
      case VehicleCategory.SUV: return 'car-suv';
      case VehicleCategory.OUTSTATION: return 'car-outstation';
      default: return 'car';
    }
  }
}

export const pricingService = new PricingService();
