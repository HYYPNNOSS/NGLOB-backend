import { Injectable } from '@nestjs/common';
import { HomeSize, ExtrasType } from '@prisma/client';

// Business rule constants
export const PRICING = {
  BASE_RATE_PER_HOUR: 60,         // £60/h for 1 mover + medium van
  ADDITIONAL_MOVER_PER_HOUR: 15,  // £15/h per extra mover
  FULL_PACKING_COST: 230,         // flat fee for full packing service
  FUEL_RATE_PER_MILE: 0.50,       // £0.50 per mile
  AVG_MILES_PER_KM: 0.621371,

  // Volume → loading time per mover (minutes per m³)
  LOADING_MINS_PER_M3: 30,

  // Minimum loading times by home size (minutes, 1 mover)
  MIN_LOADING_BY_SIZE: {
    STUDIO:   60,
    ONE:      90,
    TWO:     120,
    THREE:   180,
    FOUR_PLUS: 240,
  } as Record<HomeSize, number>,

  PACKING_MATERIALS: {
    MEDIUM_BOX: 2.30,
    LARGE_BOX:  4.00,
    BUBBLE_WRAP: 7.00,
    PAPER_ROLL: 5.00,
    TAPE:       1.00,
  } as Record<string, number>,
};

export const PRICING_ADDITIONS = {
  // Exact time booking surcharge
  EXACT_TIME_FEE: 60,

  // Storage pricing (£ per sqft per week)
  STORAGE_RATE_PER_SQFT_PER_WEEK: 0.80,

  // Delivery to/from storage (flat fee per journey)
  STORAGE_DELIVERY_FEE: 24,

  // Recommended sqft by home size
  RECOMMENDED_STORAGE_SQFT: {
    STUDIO:    30,
    ONE:       50,
    TWO:       80,
    THREE:    120,
    FOUR_PLUS: 160,
  } as Record<string, number>,
};

export interface PricingInput {
  homeSize?: HomeSize;
  moversCount: number;
  extras: ExtrasType;
  distanceKm: number;
  items?: Array<{ volumeM3: number; quantity: number }>;
  packingMaterials?: Array<{ type: string; quantity: number }>;
}

export interface PricingResult {
  loadingTimeMins: number;
  travelTimeMins: number;
  totalDurationMins: number;
  loadingTimeDisplay: string;
  travelTimeDisplay: string;
  totalDurationDisplay: string;
  baseCost: number;
  additionalMoverCost: number;
  fuelCost: number;
  fullPackingCost: number;
  packingMaterialsCost: number;
  totalToPay: number;
}

@Injectable()
export class PricingService {
  // Calculate storage weekly price from sqft
  calculateStoragePrice(sqft: number): number {
    return Math.round(sqft * PRICING_ADDITIONS.STORAGE_RATE_PER_SQFT_PER_WEEK * 100) / 100;
  }

  // Get recommended sqft for home size
  getRecommendedSqft(homeSize: string): number {
    return PRICING_ADDITIONS.RECOMMENDED_STORAGE_SQFT[homeSize] || 50;
  }

  // Full price for storage booking flow
  calculateStorageBookingTotal(params: {
    movingPriceBase: number;
    sqft: number;
    includeDeliveryToStorage: boolean;
    includeDeliveryFromStorage: boolean;
  }): {
    weeklyStoragePrice: number;
    deliveryToStorageFee: number;
    deliveryFromStorageFee: number;
    payTodayTotal: number;
    payWeeklyAmount: number;
  } {
    const weeklyStoragePrice = this.calculateStoragePrice(params.sqft);
    const deliveryToStorageFee = params.includeDeliveryToStorage
      ? PRICING_ADDITIONS.STORAGE_DELIVERY_FEE : 0;
    const deliveryFromStorageFee = params.includeDeliveryFromStorage
      ? PRICING_ADDITIONS.STORAGE_DELIVERY_FEE : 0;

    return {
      weeklyStoragePrice,
      deliveryToStorageFee,
      deliveryFromStorageFee,
      payTodayTotal: params.movingPriceBase + weeklyStoragePrice + deliveryToStorageFee,
      payWeeklyAmount: weeklyStoragePrice,
    };
  }

  calculate(input: PricingInput): PricingResult {
    const { homeSize, moversCount, extras, distanceKm, items = [], packingMaterials = [] } = input;

    // ── 1. Loading time ──────────────────────────────────────
    let loadingTimeMins: number;

    if (items.length > 0) {
      // Volume-based: total m³ × 30 min/m³ (1 mover baseline)
      const totalVolume = items.reduce(
        (acc, item) => acc + item.volumeM3 * item.quantity, 0,
      );
      loadingTimeMins = totalVolume * PRICING.LOADING_MINS_PER_M3;
    } else if (homeSize) {
      // Size-based fallback
      loadingTimeMins = PRICING.MIN_LOADING_BY_SIZE[homeSize];
    } else {
      loadingTimeMins = 60; // default 1h
    }

    // More movers = faster loading
    if (moversCount === 2) loadingTimeMins = Math.round(loadingTimeMins / 1.5);
    if (moversCount >= 3) loadingTimeMins = Math.round(loadingTimeMins / 2);

    // Minimum 30 mins
    loadingTimeMins = Math.max(30, loadingTimeMins);

    // ── 2. Travel time ───────────────────────────────────────
    // Assume average 30 km/h in London traffic
    const travelTimeMins = Math.round((distanceKm / 30) * 60);

    const totalDurationMins = loadingTimeMins + travelTimeMins;

    // ── 3. Costs ─────────────────────────────────────────────
    const totalHours = totalDurationMins / 60;

    const baseCost = Math.round(totalHours * PRICING.BASE_RATE_PER_HOUR * 100) / 100;

    const additionalMoverCost = moversCount > 1
      ? Math.round(totalHours * PRICING.ADDITIONAL_MOVER_PER_HOUR * (moversCount - 1) * 100) / 100
      : 0;

    const distanceMiles = distanceKm * PRICING.AVG_MILES_PER_KM;
    const fuelCost = Math.round(distanceMiles * PRICING.FUEL_RATE_PER_MILE * 100) / 100;

    const fullPackingCost = extras === 'FULL_PACKING' ? PRICING.FULL_PACKING_COST : 0;

    const packingMaterialsCost = packingMaterials.reduce((acc, m) => {
      const unitPrice = PRICING.PACKING_MATERIALS[m.type] || 0;
      return acc + unitPrice * m.quantity;
    }, 0);

    const totalToPay =
      Math.round(
        (baseCost + additionalMoverCost + fuelCost + fullPackingCost + packingMaterialsCost) * 100,
      ) / 100;

    // ── 4. Format display strings ─────────────────────────────
    const fmt = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h} hr`;
      return `${h} hr ${m} min`;
    };

    return {
      loadingTimeMins,
      travelTimeMins,
      totalDurationMins,
      loadingTimeDisplay: fmt(loadingTimeMins),
      travelTimeDisplay: fmt(travelTimeMins),
      totalDurationDisplay: fmt(totalDurationMins),
      baseCost,
      additionalMoverCost,
      fuelCost,
      fullPackingCost,
      packingMaterialsCost,
      totalToPay,
    };
  }
}
