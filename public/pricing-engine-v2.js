/**
 * ============================================================
 * PackZen — Pricing Engine v4.1 (Market Calibrated Base Fares)
 * ============================================================
 * Features:
 * - Real-world market-calibrated vehicle base fares
 * - Vehicle-specific per-KM rates & distance slabs
 * - Zone, traffic density, night shift & highway/interstate factors
 * - Specialized trade services (AC, Carpenter, Electrician, Crane, TV Mount)
 * - Packaging quality tiers (Standard, Premium Bubble, Wooden Crating)
 * - Zero-Commission Pass-Throughs (Tolls, Parking, Society Fees)
 * - Configurable Partner Commission Tier (Family/Brother 90% vs Standard 80%)
 */

"use strict";

const PRICING_CONFIG = Object.freeze({
  version: "4.1.0",
  minimumFare: 1999, // Updated floor price to prevent unprofitable dispatches
  
  // Partner Commission Config: Change to 10 for Family/Brother tier, 20 for Standard
  platformCommissionPercent: 10,

  // 1. VEHICLE CONFIG & VEHICLE-SPECIFIC DISTANCE RATES (Calibrated for Tier 1 Cities)
  vehicles: {
    tata_ace: {
      id: "tata_ace",
      name: "Tata Ace",
      baseFare: 1500,      // Calibrated: Starting job value ₹2,150 (w/ 1 helper)
      baseKmIncluded: 5,
      perKmRate: 24,       // Light commercial vehicle rate
      capacity: 40,
      helpersIncluded: 1,
      freeWaitingTimeMins: 60,
      overtimeRatePerHour: 300
    },
    truck_14ft: {
      id: "truck_14ft",
      name: "14 ft Truck",
      baseFare: 2900,      // Calibrated: Starting job value ₹4,200 (w/ 2 helpers)
      baseKmIncluded: 5,
      perKmRate: 32,       // Medium haul container rate
      capacity: 80,
      helpersIncluded: 2,
      freeWaitingTimeMins: 90,
      overtimeRatePerHour: 400
    },
    truck_17ft: {
      id: "truck_17ft",
      name: "17 ft Truck",
      baseFare: 4500,      // Calibrated: Starting job value ₹6,450 (w/ 3 helpers)
      baseKmIncluded: 5,
      perKmRate: 40,       // Heavy diesel container rate
      capacity: 120,
      helpersIncluded: 3,
      freeWaitingTimeMins: 120,
      overtimeRatePerHour: 500
    },
    truck_22ft: {
      id: "truck_22ft",
      name: "22 ft Truck",
      baseFare: 6500,      // Calibrated: Starting job value ₹9,100 (w/ 4 helpers)
      baseKmIncluded: 5,
      perKmRate: 52,       // Multi-axle / long container rate
      capacity: 180,
      helpersIncluded: 4,
      freeWaitingTimeMins: 180,
      overtimeRatePerHour: 700
    }
  },

  // 2. DYNAMIC DISTANCE, ZONE & TIME MULTIPLIERS
  multipliers: {
    trafficZone: {
      normal: 1.0,         // Standard urban/suburban
      denseTraffic: 1.15,  // CBD / Peak hour traffic corridor
      highwayExpress: 0.90 // Long open stretch / outer ring road
    },
    timeOfDay: {
      daySlot: 1.0,        // 6:00 AM - 9:00 PM
      nightShift: 1.20     // 9:00 PM - 6:00 AM (Night restriction & driver allowance)
    },
    interstateTax: 1.12    // 12% surcharge for state border permits & intercity paperwork
  },

  // 3. PACKAGING MATERIAL QUALITY TIERS
  packagingTiers: {
    basic: { name: "Standard Corrugated", ratePerUnit: 20 },
    premium: { name: "3-Layer Bubble Wrap & Film", ratePerUnit: 35 },
    ultraCrate: { name: "Wooden Crating & Waterproofing", ratePerUnit: 60 }
  },

  // 4. FURNITURE INVENTORY VOLUMETRICS (Unit Weights)
  furnitureUnits: {
    sofaCheck: 10, sofaCumBedCheck: 15, reclinerCheck: 12, tvCheck: 2, tvUnitCheck: 8,
    coffeeCheck: 3, centerTableCheck: 5, bookshelfCheck: 10, showcaseCheck: 12, shoeRackCheck: 4,
    bedCheck: 8, mattressCheck: 5, wardrobeCheck: 15, dressingCheck: 8, sideTableCheck: 2, studyTableCheck: 6,
    fridgeCheck: 8, wmCheck: 6, dishwasherCheck: 8, microwaveCheck: 2, ovenCheck: 4, chimneyCheck: 5,
    diningCheck: 8, waterPurifierCheck: 2, deskCheck: 8, chairCheck: 2, serverCheck: 15, printerCheck: 4,
    confCheck: 20, cabinetCheck: 10, bikeCheck: 10, cycleCheck: 5, gymCheck: 15, treadmillCheck: 15
  },

  heavyItemsList: ["sofaCheck", "sofaCumBedCheck", "bedCheck", "wardrobeCheck", "fridgeCheck", "showcaseCheck", "treadmillCheck"],
  cartonUnit: 1,

  // 5. FLOOR & ELEVATOR LOGIC
  floor: {
    withLift: 100,             // General lift operation fee
    withoutLift: 300,          // Manual stair carrying per floor
    heavyStairSurcharge: 180   // Surcharge per floor when heavy items don't fit in passenger lift
  },

  labour: {
    pricePerHelper: 650
  },

  // 6. SPECIALIZED TRADE SERVICES
  specializedServices: {
    acUninstallation: 800,
    acInstallation: 1400,
    tvWallMountRemoval: 350,
    carpenterWork: 500,        // Custom furniture fitting / drilling
    electricianWork: 450,      // Fans, geysers, light fixtures
    craneRequirement: 3500     // Balcony lifting for bulky furniture
  },

  longCarry: { pricePerMeter: 15 },
  storage: { pricePerDay: 250 },

  discounts: { maxPromoFraction: 0.30 },
  payment: { advancePercent: 15 }
});

/* ── INPUT VALIDATOR ── */

function validateQuoteInputV4(raw) {
  const errors = [];
  if (!raw.pickup || typeof raw.pickup !== "string" || !raw.pickup.trim()) errors.push("Pickup location is required.");
  if (!raw.drop || typeof raw.drop !== "string" || !raw.drop.trim()) errors.push("Drop location is required.");

  const km = Number(raw.km);
  if (isNaN(km) || km < 0) errors.push("Valid distance in kilometers is required.");

  const vehicleId = raw.vehicleId || "tata_ace";
  if (!PRICING_CONFIG.vehicles[vehicleId]) errors.push(`Unknown vehicle type: ${vehicleId}`);

  return {
    valid: errors.length === 0,
    errors,
    data: {
      ...raw,
      km: Math.max(0, km || 0),
      vehicleId,
      pickupFloor: Math.max(0, parseInt(raw.pickupFloor ?? 0, 10) || 0),
      dropFloor: Math.max(0, parseInt(raw.dropFloor ?? 0, 10) || 0),
      extraHelpers: Math.max(0, parseInt(raw.extraHelpers ?? 0, 10) || 0),
      longCarryDistance: Math.max(0, Number(raw.longCarryDistance) || 0),
      
      // Pass-through out-of-pocket expenses
      tollsEstimate: Math.max(0, Number(raw.tollsEstimate) || 0),
      parkingEstimate: Math.max(0, Number(raw.parkingEstimate) || 0),
      societyEntryFee: Math.max(0, Number(raw.societyEntryFee) || 0),
      extraWaitingHours: Math.max(0, Number(raw.extraWaitingHours) || 0),

      // Operational toggles
      trafficZone: raw.trafficZone || "normal",
      isNightShift: !!raw.isNightShift,
      isInterstate: !!raw.isInterstate,
      packagingQuality: raw.packagingQuality || "basic",
      
      // Specialized trades
      acCount: Math.max(0, parseInt(raw.acCount ?? 0, 10) || 0),
      tvMountCount: Math.max(0, parseInt(raw.tvMountCount ?? 0, 10) || 0),
      needCarpenter: !!raw.needCarpenter,
      needElectrician: !!raw.needElectrician,
      needCrane: !!raw.needCrane
    }
  };
}

/* ── CORE CALCULATOR ENGINE ── */

function calculateQuoteV4(rawInput) {
  const validation = validateQuoteInputV4(rawInput);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, finalTotal: 0 };
  }

  const d = validation.data;
  const warnings = [];
  const vehicle = PRICING_CONFIG.vehicles[d.vehicleId];

  // 1. Calculate Volumetric Inventory Units
  let totalUnits = 0;
  let heavyItemCount = 0;

  if (d.furniture && typeof d.furniture === "object") {
    for (const [id, qty] of Object.entries(d.furniture)) {
      const q = Math.max(0, parseInt(qty, 10) || 0);
      if (q > 0) {
        totalUnits += q * (PRICING_CONFIG.furnitureUnits[id] || 0);
        if (PRICING_CONFIG.heavyItemsList.includes(id)) {
          heavyItemCount += q;
        }
      }
    }
  }
  totalUnits += (parseInt(d.cartonQty, 10) || 0) * PRICING_CONFIG.cartonUnit;

  // Auto-Upgrade Check for Truck Capacity
  let selectedVehicle = vehicle;
  if (totalUnits > selectedVehicle.capacity) {
    const upgradedKey = Object.keys(PRICING_CONFIG.vehicles).find(
      k => PRICING_CONFIG.vehicles[k].capacity >= totalUnits
    );
    if (upgradedKey) {
      selectedVehicle = PRICING_CONFIG.vehicles[upgradedKey];
      warnings.push(`⚠️ Cargo volume (${totalUnits} units) exceeds ${vehicle.name}. Auto-upgraded to ${selectedVehicle.name}.`);
    } else {
      selectedVehicle = PRICING_CONFIG.vehicles.truck_22ft;
      warnings.push(`⚠️ Oversized cargo load (${totalUnits} units). Multiple trips or trucks required.`);
    }
  }

  // 2. Vehicle-Specific Distance Charge
  const baseFare = selectedVehicle.baseFare;
  const extraKm = Math.max(0, d.km - selectedVehicle.baseKmIncluded);
  let distanceCharge = Math.round(extraKm * selectedVehicle.perKmRate);

  // Apply Traffic Corridor & Shift Multipliers to distance
  const zoneFactor = PRICING_CONFIG.multipliers.trafficZone[d.trafficZone] || 1.0;
  const shiftFactor = d.isNightShift ? PRICING_CONFIG.multipliers.timeOfDay.nightShift : 1.0;
  distanceCharge = Math.round(distanceCharge * zoneFactor * shiftFactor);

  if (d.isNightShift) warnings.push("🌙 Night shift operator allowance (+20% on transit) applied.");

  // 3. Labor & Crew Charges
  const totalHelpers = selectedVehicle.helpersIncluded + d.extraHelpers;
  const labourCharge = totalHelpers * PRICING_CONFIG.labour.pricePerHelper;

  // 4. Floor Handling & Stair Surcharge
  const totalFloors = d.pickupFloor + d.dropFloor;
  let floorCharge = 0;

  if (totalFloors > 0) {
    if (d.liftAvailable && !d.isFreightLift && heavyItemCount > 0) {
      const liftFee = totalFloors * PRICING_CONFIG.floor.withLift;
      const heavyStairFee = totalFloors * PRICING_CONFIG.floor.heavyStairSurcharge;
      floorCharge = liftFee + heavyStairFee;
      warnings.push(" Notice: Passenger lift available, but heavy items incur stair carry fees.");
    } else if (d.liftAvailable) {
      floorCharge = totalFloors * PRICING_CONFIG.floor.withLift;
    } else {
      floorCharge = totalFloors * PRICING_CONFIG.floor.withoutLift;
    }
  }

  // 5. Packaging Quality Surcharge
  const pkgTier = PRICING_CONFIG.packagingTiers[d.packagingQuality] || PRICING_CONFIG.packagingTiers.basic;
  const packingCharge = d.packingService ? totalUnits * pkgTier.ratePerUnit : 0;

  // 6. Specialized Skilled Trade Charges
  let specializedTradeCharges = 0;
  if (d.acCount > 0) {
    specializedTradeCharges += d.acCount * (PRICING_CONFIG.specializedServices.acUninstallation + PRICING_CONFIG.specializedServices.acInstallation);
  }
  if (d.tvMountCount > 0) {
    specializedTradeCharges += d.tvMountCount * PRICING_CONFIG.specializedServices.tvWallMountRemoval;
  }
  if (d.needCarpenter) specializedTradeCharges += PRICING_CONFIG.specializedServices.carpenterWork;
  if (d.needElectrician) specializedTradeCharges += PRICING_CONFIG.specializedServices.electricianWork;
  if (d.needCrane) {
    specializedTradeCharges += PRICING_CONFIG.specializedServices.craneRequirement;
    warnings.push("🏗️ Balcony Crane service added for high-rise heavy lifting.");
  }

  // 7. On-Site Delays & Long Carry
  const waitingCharge = d.extraWaitingHours * selectedVehicle.overtimeRatePerHour;
  const longCarryCharge = d.longCarryDistance * PRICING_CONFIG.longCarry.pricePerMeter;

  // 8. Zero-Commission Operational Pass-Throughs (100% directly to Partner)
  const passThroughExpenses = d.tollsEstimate + d.parkingEstimate + d.societyEntryFee;

  // 9. Core Subtotal Calculation
  let serviceSubtotal = baseFare + distanceCharge + labourCharge + floorCharge +
                        packingCharge + specializedTradeCharges + waitingCharge + longCarryCharge;

  if (d.isInterstate) {
    serviceSubtotal = Math.round(serviceSubtotal * PRICING_CONFIG.multipliers.interstateTax);
  }

  // Apply Max Promo Discount (Cap at 30% of core service subtotal)
  const maxDiscount = Math.floor(serviceSubtotal * PRICING_CONFIG.discounts.maxPromoFraction);
  const cappedDiscount = Math.min(Number(d.promoDiscount) || 0, maxDiscount);

  const grandTotal = Math.max((serviceSubtotal - cappedDiscount) + passThroughExpenses, PRICING_CONFIG.minimumFare);

  // 10. Partner Payout Engine & Pass-Through Separation
  // CRITICAL TRUST RULE: Pass-through expenses (Tolls/Parking/Society) have ZERO platform commission.
  const commissionableTotal = grandTotal - passThroughExpenses;
  const platformCommission = Math.round(commissionableTotal * (PRICING_CONFIG.platformCommissionPercent / 100));
  const partnerPayout = (commissionableTotal - platformCommission) + passThroughExpenses;

  const advanceAmount = Math.round(grandTotal * (PRICING_CONFIG.payment.advancePercent / 100));

  return {
    valid: true,
    warnings,
    finalTotal: grandTotal,
    breakdown: {
      vehicleUsed: selectedVehicle.name,
      baseFare,
      distanceCharge,
      labourCharge,
      floorCharge,
      packingCharge,
      specializedTradeCharges,
      waitingCharge,
      longCarryCharge,
      passThroughExpenses,
      discount: cappedDiscount,
      grandTotal
    },
    financials: {
      customerPays: grandTotal,
      partnerEarns: partnerPayout,       // Includes 100% of out-of-pocket tolls/parking
      packZenMargin: platformCommission,  // Platform 10% or 20% commission on service value
      partnerTakePercent: Math.round((partnerPayout / grandTotal) * 100)
    },
    paymentOptions: {
      advanceAmount,
      atDropAmount: grandTotal - advanceAmount
    },
    capacityDetail: {
      totalUnits,
      vehicleCapacity: selectedVehicle.capacity,
      utilizationPercent: Math.round((totalUnits / selectedVehicle.capacity) * 100)
    },
    km: Math.round(d.km)
  };
}

// Global Export
window.PackZenPricingV4 = {
  version: PRICING_CONFIG.version,
  config: PRICING_CONFIG,
  calculateQuote: calculateQuoteV4,
  validateInput: validateQuoteInputV4
};
```

---

### Summary of Changes in v4.1:
1. **Tata Ace Base:** ₹1,200 $\rightarrow$ **₹1,500** (Total base w/ helper = **₹2,150**)
2. **14ft Truck Base:** ₹2,200 $\rightarrow$ **₹2,900** (Total base w/ 2 helpers = **₹4,200**)
3. **17ft Truck Base:** ₹3,200 $\rightarrow$ **₹4,500** (Total base w/ 3 helpers = **₹6,450**)
4. **22ft Truck Base:** ₹4,500 $\rightarrow$ **₹6,500** (Total base w/ 4 helpers = **₹9,100**)
5. **Minimum Order Value Floor:** ₹1,499 $\rightarrow$ **₹1,999**
6. **Slight Distance Adjustment:** Adjusted Tata Ace/14ft/17ft/22ft per-km rates to ₹24, ₹32, ₹40, and ₹52 respectively.
