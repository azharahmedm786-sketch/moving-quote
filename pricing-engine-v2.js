/**
 * ============================================================
 * PackZen — Pricing Engine v2.0
 * ============================================================
 * Author  : PackZen Technical Team
 * Version : 2.0.0
 * Created : June 2026
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * 1. PRICING_CONFIG  — Single source of truth for ALL prices.
 *                      Edit values here only.
 * 2. VEHICLE_CONFIG  — All vehicle definitions + capacity rules.
 * 3. Pure calculation functions — no DOM access, no side-effects.
 * 4. calculateQuoteV2() — main entry point, returns a full
 *    QuoteResult object consumed by the existing UI layer.
 * 5. Validation layer — guards against all invalid inputs.
 * 6. Recommendation engine — suggests vehicle, helpers, timing.
 * 7. Profit engine — internal only, never exposed to customers.
 *
 * HOW TO UPDATE PRICES (future maintainer)
 * ─────────────────────────────────────────
 * • Every chargeable value lives in PRICING_CONFIG below.
 * • Change the number there and the entire site updates.
 * • No need to grep through thousands of lines.
 *
 * BACKWARD COMPATIBILITY
 * ──────────────────────
 * • The old calculateQuote(auto) function still exists in
 *   script.js and keeps working unchanged.
 * • This engine is additive — it runs in parallel and writes
 *   the same global `lastCalculatedTotal` so all payment and
 *   booking flows continue to work without modification.
 * ============================================================
 */

"use strict";

/* ============================================================
   SECTION 1 — PRICING CONFIGURATION (SINGLE SOURCE OF TRUTH)
   ============================================================ */

const PRICING_CONFIG = Object.freeze({

  /** Engine version — bump when config changes */
  version: "2.0.0",

  /** Minimum chargeable amount for any booking */
  minimumFare: 1499,

  /* ── LOCAL SHIFTING ──────────────────────────────────────── */
  local: {
    /**
     * Free distance included in base fare (km).
     * Customer pays nothing extra within this range.
     */
    freeKm: 5,

    /**
     * Vehicle base fares and per-km rates.
     * Key must match vehicle id in VEHICLE_CONFIG.
     *   baseFare   — flat charge for up to `freeKm` km
     *   perKm      — charged for every km beyond freeKm
     *   operCost   — our internal cost estimate (fuel + driver)
     */
    vehicles: {
      tata_ace:   { baseFare: 1999, perKm: 28, operCost: 1200 },
      truck_14ft: { baseFare: 4500, perKm: 42, operCost: 2800 },
      truck_17ft: { baseFare: 6000, perKm: 50, operCost: 3500 },
      truck_22ft: { baseFare: 7500, perKm: 58, operCost: 4500 },
    },
  },

  /* ── INTERCITY SHIFTING ──────────────────────────────────── */
  intercity: {
    /**
     * Distance threshold in km above which a move is intercity.
     */
    thresholdKm: 100,

    /**
     * Slab-based pricing indexed by [houseValue][distanceSlab].
     * houseValue  — matches the HTML <select> option value
     * distanceSlab — "400" | "600" | "1000" | "2000" (max km in slab)
     *
     * These are ALL-INCLUSIVE base rates (no extra per-km).
     */
    slabs: {
      "2500":  { "400": 8000,  "600": 9500,  "1000": 14000, "2000": 20000 },
      "4500":  { "400": 8500,  "600": 10500, "1000": 15500, "2000": 22000 },
      "6500":  { "400": 10500, "600": 12500, "1000": 18500, "2000": 26000 },
      "8500":  { "400": 12500, "600": 15000, "1000": 22000, "2000": 30000 },
      "10500": { "400": 14500, "600": 17500, "1000": 26000, "2000": 35000 },
      "13500": { "400": 17000, "600": 20500, "1000": 30000, "2000": 42000 },
      /* Office */
      "6500_office":  { "400": 12000, "600": 15000, "1000": 22000, "2000": 32000 },
      "10500_office": { "400": 15000, "600": 18000, "1000": 26000, "2000": 38000 },
      "16500_office": { "400": 20000, "600": 24000, "1000": 34000, "2000": 48000 },
      "25500_office": { "400": 28000, "600": 34000, "1000": 48000, "2000": 65000 },
    },

    /** Default fallback rate when house value has no slab entry */
    fallbackRate: 12000,

    /** Our internal cost multiplier vs the slab rate */
    operCostRatio: 0.62,
  },

  /* ── SINGLE ITEM SHIFTING ────────────────────────────────── */
  singleItem: {
    baseFare: 1499,
    operCost: 800,
  },

  /* ── FURNITURE ITEM PRICES ───────────────────────────────── */
  /**
   * Price per unit charged for each furniture item.
   * 0 = FREE (still tracked for recommendations).
   * Key matches the HTML input `id`.
   */
  furniturePrices: {
    /* Living Room */
    sofaCheck:       250,
    tvCheck:         150,
    tvUnitCheck:     250,
    coffeeCheck:     100,
    acCheck:         500,
    /* Bedroom */
    bedCheck:        350,
    wardrobeCheck:   600,
    dressingCheck:   250,
    sideTableCheck:  100,
    /* Kitchen — FREE */
    fridgeCheck:     0,
    wmCheck:         0,
    microwaveCheck:  0,
    chimneyCheck:    0,
    diningCheck:     0,
    /* Office — FREE (base covers it) */
    deskCheck:       0,
    chairCheck:      0,
    serverCheck:     0,
    printerCheck:    0,
    confCheck:       0,
    cabinetCheck:    0,
    whiteboardCheck: 0,
    /* Others — FREE */
    bikeCheck:       0,
    cycleCheck:      0,
    plantCheck:      0,
    gymCheck:        0,
  },

  /* ── CARTON BOXES ────────────────────────────────────────── */
  cartons: {
    pricePerBox: 50,
    operCostPerBox: 30,
  },

  /* ── FLOOR CHARGES ───────────────────────────────────────── */
  /**
   * Charged per floor at pickup + drop combined.
   * E.g. pickup floor 2 + drop floor 3 = 5 floors.
   */
  floor: {
    withLift:    150,   // ₹ per floor when lift available
    withoutLift: 300,   // ₹ per floor when no lift
    operCostRatio: 0.5,
  },

  /* ── PACKING CHARGES ─────────────────────────────────────── */
  /**
   * Optional add-on packing service.
   * Currently not surfaced in UI but ready for future use.
   */
  packing: {
    "1rk":    800,
    "1bhk":  1200,
    "2bhk":  2000,
    "3bhk":  3000,
    "4bhk":  4000,
    "villa": 5500,
    "office_cabin": 1500,
    "office_small": 2500,
    "office_medium": 4000,
    "office_large": 7000,
  },

  /* ── LABOUR CHARGES ──────────────────────────────────────── */
  /**
   * Additional helpers beyond the driver.
   * Not currently surfaced in UI — ready for future.
   */
  labour: {
    pricePerHelper: 400,   // ₹ per extra helper per move
    operCostPerHelper: 300,
  },

  /* ── INSURANCE ───────────────────────────────────────────── */
  /**
   * Transit insurance.
   * Currently included in base — set `included: true`.
   * Set `included: false` and specify `percent` to charge it.
   */
  insurance: {
    included: true,
    percent: 0.5,   // 0.5% of declared goods value if charged
    operCostRatio: 0.8,
  },

  /* ── GST ─────────────────────────────────────────────────── */
  /**
   * GST is currently factored into prices (inclusive).
   * Set `inclusive: false` to add on top.
   */
  gst: {
    inclusive: true,
    rate: 18,   // 18%
  },

  /* ── PAYMENT OPTIONS ─────────────────────────────────────── */
  payment: {
    advancePercent: 10,       // 10% advance payment
    fullPaymentDiscount: 200, // ₹200 off for full upfront payment
  },

  /* ── SURCHARGES ──────────────────────────────────────────── */
  surcharges: {
    /**
     * Night surcharge: applied to bookings 9 PM – 7 AM.
     * Expressed as a multiplier on the final total.
     */
    night: {
      enabled: true,
      startHour: 21,  // 9 PM
      endHour: 7,     // 7 AM
      multiplier: 1.15, // +15%
    },

    /**
     * Weekend surcharge: Saturday & Sunday.
     * dayOfWeek: 0 = Sunday, 6 = Saturday
     */
    weekend: {
      enabled: true,
      days: [0, 6],
      multiplier: 1.10, // +10%
    },

    /**
     * Rain / monsoon surcharge.
     * Months: 0-indexed. 5 = Jun, 6 = Jul, 7 = Aug, 8 = Sep
     */
    rain: {
      enabled: true,
      months: [5, 6, 7, 8],
      multiplier: 1.08, // +8%
    },

    /**
     * Waiting charge per hour beyond the free window.
     */
    waiting: {
      freeHours: 1,
      pricePerHour: 200,
    },
  },

  /* ── DISCOUNTS ───────────────────────────────────────────── */
  discounts: {
    /** Maximum promo discount as fraction of total */
    maxPromoFraction: 0.5,
    referralAmount: 100,
  },
});


/* ============================================================
   SECTION 2 — VEHICLE CONFIGURATION
   ============================================================ */

/**
 * Central vehicle registry.
 * Each entry defines capacity constraints and metadata.
 *
 * minHouseValue / maxHouseValue:
 *   The range of house size `value` (from MOVE_TYPE_CONFIG)
 *   this vehicle can legally serve.
 *   Prevent impossible combos like 3 BHK + Tata Ace.
 *
 * htmlValue:
 *   Must match the `value` attribute on the HTML <option>
 *   for backward compatibility.
 */
const VEHICLE_CONFIG = Object.freeze({
  tata_ace: {
    id:            "tata_ace",
    htmlValue:     "200",
    name:          "Tata Ace",
    icon:          "🛻",
    sub:           "Ideal for single items & 1 RK",
    displayRate:   "From ₹1,999",
    minHouseValue: 0,
    maxHouseValue: 2500,   // up to 1 RK
    moveTypes:     ["home", "single"],
    capacityM3:    12,     // approx cubic metres
    helpers:       1,      // recommended helpers (beyond driver)
    loadTimeMin:   45,     // estimated loading time in minutes
    unloadTimeMin: 30,
  },
  truck_14ft: {
    id:            "truck_14ft",
    htmlValue:     "2500",
    name:          "14 ft Truck",
    icon:          "🚚",
    sub:           "Ideal for 1–2 BHK",
    displayRate:   "From ₹4,500",
    minHouseValue: 2500,
    maxHouseValue: 6500,   // up to 2 BHK
    moveTypes:     ["home", "office", "intercity"],
    capacityM3:    40,
    helpers:       2,
    loadTimeMin:   90,
    unloadTimeMin: 60,
  },
  truck_17ft: {
    id:            "truck_17ft",
    htmlValue:     "4000",
    name:          "17 ft Truck",
    icon:          "🚛",
    sub:           "Ideal for 2–3 BHK",
    displayRate:   "From ₹6,000",
    minHouseValue: 6500,
    maxHouseValue: 10500,  // up to 3 BHK
    moveTypes:     ["home", "office", "intercity"],
    capacityM3:    55,
    helpers:       3,
    loadTimeMin:   150,
    unloadTimeMin: 120,
  },
  truck_22ft: {
    id:            "truck_22ft",
    htmlValue:     "5500",
    name:          "22 ft Truck",
    icon:          "🚜",
    sub:           "Ideal for 3+ BHK",
    displayRate:   "From ₹7,500",
    minHouseValue: 8500,
    maxHouseValue: Infinity,
    moveTypes:     ["home", "office", "intercity"],
    capacityM3:    80,
    helpers:       4,
    loadTimeMin:   240,
    unloadTimeMin: 180,
  },
});

/**
 * Ordered list of vehicles from smallest to largest.
 * Used for upgrade recommendations.
 */
const VEHICLE_ORDER = ["tata_ace", "truck_14ft", "truck_17ft", "truck_22ft"];


/* ============================================================
   SECTION 3 — VALIDATION LAYER
   ============================================================ */

/**
 * Validates and normalises a raw quote input object.
 * Returns { valid: true, data } or { valid: false, errors[] }.
 *
 * @param {object} raw — values collected from the DOM or a test
 * @returns {{ valid: boolean, errors: string[], data: object }}
 */
function validateQuoteInput(raw) {
  const errors = [];

  /* ── Locations ── */
  if (!raw.pickup || typeof raw.pickup !== "string" || !raw.pickup.trim()) {
    errors.push("Pickup location is required.");
  }
  if (!raw.drop || typeof raw.drop !== "string" || !raw.drop.trim()) {
    errors.push("Drop location is required.");
  }

  /* ── Distance ── */
  const km = Number(raw.km);
  if (isNaN(km) || km < 0) {
    errors.push("Distance (km) must be a non-negative number.");
  }

  /* ── Date ── */
  let shiftDate = null;
  if (raw.shiftDate) {
    shiftDate = new Date(raw.shiftDate + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(shiftDate.getTime())) {
      errors.push("Shift date is invalid.");
      shiftDate = null;
    } else if (shiftDate < today) {
      errors.push("Shift date cannot be in the past.");
      shiftDate = null;
    }
  }

  /* ── House / size value ── */
  const houseValue = Number(raw.houseValue) || 0;
  if (houseValue < 0 || isNaN(houseValue)) {
    errors.push("House/size value is invalid.");
  }

  /* ── Vehicle ── */
  const vehicleHtmlValue = String(raw.vehicleHtmlValue || "0");
  let vehicleCfg = null;
  if (vehicleHtmlValue !== "0") {
    vehicleCfg = _vehicleByHtmlValue(vehicleHtmlValue);
    if (!vehicleCfg) {
      errors.push(`Unknown vehicle value: ${vehicleHtmlValue}.`);
    }
  }

  /* ── Furniture quantities ── */
  const furniture = {};
  for (const [id, price] of Object.entries(PRICING_CONFIG.furniturePrices)) {
    const qty = parseInt(raw.furniture?.[id] ?? 0, 10);
    if (isNaN(qty) || qty < 0) {
      errors.push(`Invalid quantity for ${id}.`);
      furniture[id] = 0;
    } else if (qty > 20) {
      errors.push(`Quantity for ${id} cannot exceed 20.`);
      furniture[id] = 20;
    } else {
      furniture[id] = qty;
    }
  }

  /* ── Cartons ── */
  const cartonQty = parseInt(raw.cartonQty ?? 0, 10);
  if (isNaN(cartonQty) || cartonQty < 0) {
    errors.push("Carton quantity must be a non-negative integer.");
  } else if (cartonQty > 50) {
    errors.push("Carton quantity cannot exceed 50.");
  }

  /* ── Floors ── */
  const pickupFloor = Math.max(0, parseInt(raw.pickupFloor ?? 0, 10) || 0);
  const dropFloor   = Math.max(0, parseInt(raw.dropFloor   ?? 0, 10) || 0);
  const liftAvail   = Boolean(raw.liftAvailable);

  /* ── Move type ── */
  const validTypes = ["home", "office", "single"];
  const moveType = validTypes.includes(raw.moveType) ? raw.moveType : "home";

  /* ── Shift time (for surcharges) ── */
  let shiftHour = null;
  if (raw.shiftHour !== undefined && raw.shiftHour !== null) {
    shiftHour = parseInt(raw.shiftHour, 10);
    if (isNaN(shiftHour) || shiftHour < 0 || shiftHour > 23) {
      shiftHour = null;
    }
  }

  const data = {
    pickup:           (raw.pickup || "").trim(),
    drop:             (raw.drop   || "").trim(),
    km:               Math.max(0, km || 0),
    houseValue,
    vehicleHtmlValue,
    vehicleCfg,
    furniture,
    cartonQty:        Math.min(50, Math.max(0, cartonQty || 0)),
    pickupFloor,
    dropFloor,
    liftAvailable:    liftAvail,
    moveType,
    shiftDate,
    shiftHour,
    promoDiscount:    Math.max(0, Number(raw.promoDiscount) || 0),
  };

  return { valid: errors.length === 0, errors, data };
}

/**
 * Validates vehicle–house compatibility.
 * Returns { ok, warning, recommended }.
 */
function validateVehicleCapacity(vehicleCfg, houseValue, moveType) {
  if (!vehicleCfg || houseValue === 0) {
    return { ok: true, warning: null, recommended: null };
  }

  const house = Number(houseValue);

  // Too small
  if (house > vehicleCfg.maxHouseValue) {
    const rec = _recommendVehicleForHouse(house, moveType);
    return {
      ok: false,
      warning: `⚠️ ${vehicleCfg.name} is too small for this house size. We recommend the ${rec?.name || "a larger vehicle"}.`,
      recommended: rec,
    };
  }

  // Too large (not strictly wrong, just advisory)
  if (house < vehicleCfg.minHouseValue && house > 0) {
    const smaller = _recommendVehicleForHouse(house, moveType);
    return {
      ok: true, // allow it, just advise
      warning: `💡 ${vehicleCfg.name} may be larger than needed. You could save with the ${smaller?.name || "a smaller vehicle"}.`,
      recommended: smaller,
    };
  }

  if (!vehicleCfg.moveTypes.includes(moveType) && moveType !== "single") {
    return {
      ok: false,
      warning: `⚠️ ${vehicleCfg.name} is not suitable for ${moveType} shifting.`,
      recommended: null,
    };
  }

  return { ok: true, warning: null, recommended: null };
}


/* ============================================================
   SECTION 4 — PURE CALCULATION FUNCTIONS
   Each function has ONE responsibility.
   None of them touch the DOM.
   ============================================================ */

/**
 * Calculates the cost for furniture items.
 * @returns {{ itemCost, itemCount }}
 */
function calcFurnitureCost(furniture) {
  let itemCost = 0, itemCount = 0;
  for (const [id, qty] of Object.entries(furniture)) {
    if (qty > 0) {
      const price = PRICING_CONFIG.furniturePrices[id] ?? 0;
      itemCost += price * qty;
      itemCount += qty;
    }
  }
  return { itemCost, itemCount };
}

/**
 * Calculates the carton box cost.
 */
function calcCartonCost(cartonQty) {
  return cartonQty * PRICING_CONFIG.cartons.pricePerBox;
}

/**
 * Calculates floor charges.
 */
function calcFloorCost(pickupFloor, dropFloor, liftAvailable) {
  const totalFloors = (pickupFloor || 0) + (dropFloor || 0);
  if (totalFloors === 0) return 0;
  const rate = liftAvailable
    ? PRICING_CONFIG.floor.withLift
    : PRICING_CONFIG.floor.withoutLift;
  return totalFloors * rate;
}

/**
 * Determines which distance slab applies for intercity.
 * Returns the slab key ("400" | "600" | "1000" | "2000").
 */
function getIntercitySlab(km) {
  if (km <= 400)  return "400";
  if (km <= 600)  return "600";
  if (km <= 1000) return "1000";
  return "2000";
}

/**
 * Returns a human-readable label for an intercity slab.
 */
function getSlabLabel(slab) {
  const labels = {
    "400":  "up to 400 km",
    "600":  "up to 600 km",
    "1000": "up to 1,000 km",
    "2000": "1,000+ km",
  };
  return labels[slab] || slab;
}

/**
 * Gets the intercity base rate for a house value and distance.
 * Supports both home and office keys.
 */
function calcIntercityBase(houseValue, moveType, km) {
  const cfg = PRICING_CONFIG.intercity;
  const slab = getIntercitySlab(km);

  // Try office-specific key first
  const officeKey = `${houseValue}_office`;
  if (moveType === "office" && cfg.slabs[officeKey]) {
    return cfg.slabs[officeKey][slab] ?? cfg.fallbackRate;
  }

  // Standard key
  const key = String(houseValue);
  if (cfg.slabs[key]) {
    return cfg.slabs[key][slab] ?? cfg.fallbackRate;
  }

  return cfg.fallbackRate;
}

/**
 * Calculates local shifting fare (distance-based).
 * Returns { baseFare, extraKmCost, distanceFare }.
 */
function calcLocalDistanceFare(vehicleCfg, km) {
  const vId = vehicleCfg?.id;
  const vRates = PRICING_CONFIG.local.vehicles[vId];

  // Fallback if vehicle not in config
  if (!vRates) {
    return { baseFare: 2500, extraKmCost: 0, distanceFare: 2500 };
  }

  const freeKm   = PRICING_CONFIG.local.freeKm;
  const baseFare = vRates.baseFare;
  const extraKm  = Math.max(0, km - freeKm);
  const extraKmCost = Math.round(extraKm * vRates.perKm);

  return {
    baseFare,
    extraKm:     +extraKm.toFixed(2),
    perKmRate:   vRates.perKm,
    extraKmCost,
    distanceFare: baseFare + extraKmCost,
  };
}

/**
 * Applies surcharges (night / weekend / rain) to a subtotal.
 * Returns { finalAmount, appliedSurcharges[] }.
 */
function applySurcharges(subtotal, shiftDate, shiftHour) {
  const cfg = PRICING_CONFIG.surcharges;
  let amount = subtotal;
  const applied = [];

  if (!shiftDate) return { finalAmount: Math.round(amount), appliedSurcharges: applied };

  const dayOfWeek = shiftDate.getDay();
  const month     = shiftDate.getMonth();

  // Night surcharge
  if (cfg.night.enabled && shiftHour !== null) {
    const isNight = shiftHour >= cfg.night.startHour || shiftHour < cfg.night.endHour;
    if (isNight) {
      amount *= cfg.night.multiplier;
      applied.push({
        label: "Night Surcharge",
        percent: Math.round((cfg.night.multiplier - 1) * 100),
      });
    }
  }

  // Weekend surcharge
  if (cfg.weekend.enabled && cfg.weekend.days.includes(dayOfWeek)) {
    amount *= cfg.weekend.multiplier;
    applied.push({
      label: "Weekend Surcharge",
      percent: Math.round((cfg.weekend.multiplier - 1) * 100),
    });
  }

  // Rain / monsoon surcharge
  if (cfg.rain.enabled && cfg.rain.months.includes(month)) {
    amount *= cfg.rain.multiplier;
    applied.push({
      label: "Monsoon Surcharge",
      percent: Math.round((cfg.rain.multiplier - 1) * 100),
    });
  }

  return {
    finalAmount: Math.round(amount),
    appliedSurcharges: applied,
  };
}

/**
 * Applies a promo discount (capped at maxPromoFraction).
 */
function applyPromoDiscount(total, promoDiscount) {
  const maxDiscount = Math.floor(
    total * PRICING_CONFIG.discounts.maxPromoFraction
  );
  return Math.min(promoDiscount, maxDiscount);
}

/**
 * Calculates payment option amounts.
 */
function calcPaymentOptions(discountedTotal) {
  const cfg = PRICING_CONFIG.payment;
  const advanceAmt = Math.round(discountedTotal * (cfg.advancePercent / 100));
  const fullAmt    = Math.max(discountedTotal - cfg.fullPaymentDiscount, 0);
  return {
    atDropAmount: discountedTotal,
    advanceAmount: advanceAmt,
    fullOnlineAmount: fullAmt,
    fullOnlineSaving: cfg.fullPaymentDiscount,
  };
}


/* ============================================================
   SECTION 5 — PROFIT / OPERATIONAL COST ENGINE
   (Internal only — never rendered to customers)
   ============================================================ */

/**
 * Estimates operational costs for a quote.
 * Returns { operCost, profit, profitPercent }.
 *
 * This data is attached to every QuoteResult under
 * result._internal — ready for an admin dashboard.
 */
function calcInternalProfit(quoteComponents) {
  const {
    km, vehicleCfg, isIntercity, furniture, cartonQty,
    totalFloors, liftAvailable, finalTotal,
  } = quoteComponents;

  let operCost = 0;

  if (isIntercity) {
    operCost = Math.round(finalTotal * PRICING_CONFIG.intercity.operCostRatio);
  } else if (vehicleCfg) {
    const vRates = PRICING_CONFIG.local.vehicles[vehicleCfg.id];
    if (vRates) {
      // Base vehicle cost
      operCost += vRates.operCost;
      // Fuel for extra km (rough estimate: ₹12/km for small, ₹22/km for large)
      const fuelPerKm = vRates.operCost < 2000 ? 10 : 18;
      operCost += Math.round(km * fuelPerKm);
    }
  } else {
    operCost = PRICING_CONFIG.singleItem.operCost;
  }

  // Floor handling cost
  const floorRate = liftAvailable
    ? PRICING_CONFIG.floor.withLift * PRICING_CONFIG.floor.operCostRatio
    : PRICING_CONFIG.floor.withoutLift * PRICING_CONFIG.floor.operCostRatio;
  operCost += Math.round(totalFloors * floorRate);

  // Carton cost
  operCost += cartonQty * PRICING_CONFIG.cartons.operCostPerBox;

  // Labour for furniture items
  let totalItems = 0;
  for (const qty of Object.values(furniture)) totalItems += qty;
  const helperCost = Math.round(
    totalItems * (PRICING_CONFIG.labour.operCostPerHelper / 10)
  );
  operCost += helperCost;

  const profit = Math.max(0, finalTotal - operCost);
  const profitPercent = finalTotal > 0
    ? Math.round((profit / finalTotal) * 100)
    : 0;

  return { operCost, profit, profitPercent };
}


/* ============================================================
   SECTION 6 — RECOMMENDATION ENGINE
   ============================================================ */

/**
 * Returns a vehicle recommendation object for a given house value.
 * Picks the smallest vehicle that can handle the house.
 */
function recommendVehicle(houseValue, moveType, isIntercity) {
  const house = Number(houseValue);

  for (const id of VEHICLE_ORDER) {
    const v = VEHICLE_CONFIG[id];
    if (
      house <= v.maxHouseValue &&
      house >= v.minHouseValue - 1 &&
      (v.moveTypes.includes(moveType) || isIntercity)
    ) {
      return {
        id:          v.id,
        htmlValue:   v.htmlValue,
        name:        v.name,
        icon:        v.icon,
        sub:         v.sub,
        helpers:     v.helpers,
        loadTimeMin: v.loadTimeMin,
        unloadTimeMin: v.unloadTimeMin,
      };
    }
  }

  // Fallback to largest
  const last = VEHICLE_CONFIG[VEHICLE_ORDER[VEHICLE_ORDER.length - 1]];
  return {
    id:          last.id,
    htmlValue:   last.htmlValue,
    name:        last.name,
    icon:        last.icon,
    sub:         last.sub,
    helpers:     last.helpers,
    loadTimeMin: last.loadTimeMin,
    unloadTimeMin: last.unloadTimeMin,
  };
}

/**
 * Recommends helpers count based on house size and item count.
 */
function recommendHelpers(houseValue, itemCount) {
  const house = Number(houseValue);
  if (house <= 2500 || itemCount <= 3) return 1;
  if (house <= 6500 || itemCount <= 10) return 2;
  if (house <= 10500 || itemCount <= 20) return 3;
  return 4;
}

/**
 * Returns packing material recommendations.
 */
function recommendPackingMaterials(furniture, cartonQty, houseValue) {
  const house = Number(houseValue);
  let totalItems = 0;
  for (const qty of Object.values(furniture)) totalItems += qty;

  const rec = [];

  const boxes = cartonQty > 0 ? cartonQty : Math.ceil(house / 1000) * 3 + totalItems;
  rec.push({ item: "Carton Boxes",       qty: boxes,                unit: "boxes" });
  rec.push({ item: "Bubble Wrap",        qty: Math.ceil(boxes / 3), unit: "rolls" });
  rec.push({ item: "Packing Tape",       qty: Math.ceil(boxes / 5), unit: "rolls" });
  rec.push({ item: "Stretch Film",       qty: 2,                    unit: "rolls" });
  rec.push({ item: "Foam Sheets",        qty: Math.max(5, totalItems), unit: "sheets" });

  return rec;
}

/**
 * Estimates delivery duration in hours for intercity moves.
 */
function estimateDeliveryHours(km) {
  if (km <= 100)  return { min: 2,  max: 4  };
  if (km <= 300)  return { min: 6,  max: 10 };
  if (km <= 600)  return { min: 14, max: 22 };
  if (km <= 1000) return { min: 24, max: 36 };
  return { min: 36, max: 60 };
}


/* ============================================================
   SECTION 7 — MAIN ENTRY POINT: calculateQuoteV2()
   ============================================================ */

/**
 * Primary pricing function.
 * Accepts a raw input object (can come from DOM or a test).
 * Returns a rich QuoteResult — never throws.
 *
 * QuoteResult shape:
 * {
 *   valid: boolean,
 *   errors: string[],
 *   warnings: string[],
 *
 *   // Breakdown (shown to customer)
 *   breakdown: {
 *     baseFare, distanceCharge, furnitureCharge, cartonCharge,
 *     floorCharge, packingCharge, insuranceCharge,
 *     surcharges: [{ label, percent, amount }],
 *     subtotal, gstAmount, gstInclusive,
 *     discount, grandTotal,
 *   },
 *
 *   // Payment options
 *   paymentOptions: { atDropAmount, advanceAmount, fullOnlineAmount, fullOnlineSaving },
 *
 *   // Recommendations
 *   recommendations: {
 *     vehicle, helpers, packingMaterials,
 *     loadTimeMin, unloadTimeMin, deliveryHours
 *   },
 *
 *   // Capacity validation
 *   capacityCheck: { ok, warning, recommended },
 *
 *   // Surcharges applied
 *   surchargesApplied: [{ label, percent }],
 *
 *   // Legacy compat — written to window.lastCalculatedTotal
 *   finalTotal: number,
 *   isIntercity: boolean,
 *
 *   // Internal (admin dashboard use only — never render to customer)
 *   _internal: { operCost, profit, profitPercent, engineVersion }
 * }
 */
function calculateQuoteV2(raw) {
  // ── Step 1: Validate ──────────────────────────────────────
  const { valid, errors, data } = validateQuoteInput(raw);

  if (!valid) {
    return _errorResult(errors);
  }

  const {
    km, houseValue, vehicleCfg, vehicleHtmlValue,
    furniture, cartonQty, pickupFloor, dropFloor,
    liftAvailable, moveType, shiftDate, shiftHour,
    promoDiscount: rawPromo,
  } = data;

  const isIntercity = km > PRICING_CONFIG.intercity.thresholdKm;

  // ── Step 2: Capacity check ────────────────────────────────
  const capacityCheck = validateVehicleCapacity(vehicleCfg, houseValue, moveType);

  // ── Step 3: Component costs ───────────────────────────────
  const { itemCost, itemCount } = calcFurnitureCost(furniture);
  const cartonCost  = calcCartonCost(cartonQty);
  const furnitureCost = itemCost;
  const floorCost   = calcFloorCost(pickupFloor, dropFloor, liftAvailable);
  const totalFloors = (pickupFloor || 0) + (dropFloor || 0);

  // ── Step 4: Base / distance fare ─────────────────────────
  let baseFare        = 0;
  let distanceCharge  = 0;
  let localDetails    = null;

  if (moveType === "single" && !houseValue) {
    baseFare = PRICING_CONFIG.singleItem.baseFare;
  } else if (isIntercity) {
    baseFare = calcIntercityBase(houseValue, moveType, km);
  } else {
    // Local — vehicle required
    if (vehicleCfg) {
      localDetails = calcLocalDistanceFare(vehicleCfg, km);
      baseFare     = localDetails.baseFare;
      distanceCharge = localDetails.extraKmCost;
    } else {
      // No vehicle selected yet; return minimal fare
      baseFare = PRICING_CONFIG.minimumFare;
    }
  }

  // ── Step 5: Subtotal before surcharges ───────────────────
  const subtotalPreSurcharge = Math.round(
    baseFare + distanceCharge + furnitureCost + cartonCost + floorCost
  );

  // ── Step 6: Surcharges ────────────────────────────────────
  const { finalAmount: subtotalAfterSurcharge, appliedSurcharges } =
    applySurcharges(subtotalPreSurcharge, shiftDate, shiftHour);

  // ── Step 7: GST (currently inclusive) ────────────────────
  const gstCfg = PRICING_CONFIG.gst;
  let gstAmount = 0;
  let subtotalWithGST = subtotalAfterSurcharge;

  if (!gstCfg.inclusive) {
    gstAmount      = Math.round(subtotalAfterSurcharge * gstCfg.rate / 100);
    subtotalWithGST = subtotalAfterSurcharge + gstAmount;
  } else {
    // Show the implied GST amount for transparency
    gstAmount = Math.round(subtotalAfterSurcharge * gstCfg.rate / (100 + gstCfg.rate));
  }

  // ── Step 8: Minimum fare floor ────────────────────────────
  const totalBeforeDiscount = Math.max(subtotalWithGST, PRICING_CONFIG.minimumFare);

  // ── Step 9: Promo discount ────────────────────────────────
  const cappedDiscount = applyPromoDiscount(totalBeforeDiscount, rawPromo);
  const grandTotal = Math.max(totalBeforeDiscount - cappedDiscount, 0);

  // ── Step 10: Payment options ──────────────────────────────
  const paymentOptions = calcPaymentOptions(grandTotal);

  // ── Step 11: Surcharge line items (with ₹ amounts) ───────
  const surchargeLines = appliedSurcharges.map(s => ({
    ...s,
    amount: Math.round(subtotalPreSurcharge * (s.percent / 100)),
  }));

  // ── Step 12: Recommendations ─────────────────────────────
  const recVehicle  = recommendVehicle(houseValue, moveType, isIntercity);
  const recHelpers  = recommendHelpers(houseValue, itemCount);
  const recPacking  = recommendPackingMaterials(furniture, cartonQty, houseValue);
  const deliveryHrs = isIntercity ? estimateDeliveryHours(km) : null;
  const loadTime    = vehicleCfg?.loadTimeMin  ?? recVehicle.loadTimeMin;
  const unloadTime  = vehicleCfg?.unloadTimeMin ?? recVehicle.unloadTimeMin;

  // ── Step 13: Internal profit ──────────────────────────────
  const _internal = calcInternalProfit({
    km, vehicleCfg, isIntercity, furniture, cartonQty,
    totalFloors, liftAvailable, finalTotal: grandTotal,
  });
  _internal.engineVersion = PRICING_CONFIG.version;

  // ── Step 14: Build breakdown ──────────────────────────────
  const breakdown = {
    baseFare,
    distanceCharge,
    furnitureCharge: furnitureCost,
    cartonCharge:    cartonCost,
    floorCharge:     floorCost,
    packingCharge:   0,     // future: packing add-on
    insuranceCharge: 0,     // future: optional insurance
    surcharges:      surchargeLines,
    subtotal:        subtotalPreSurcharge,
    gstAmount,
    gstInclusive:    gstCfg.inclusive,
    discount:        cappedDiscount,
    grandTotal,
    // Extra detail for local moves
    ...(localDetails ? {
      localDetail: {
        freeKm: PRICING_CONFIG.local.freeKm,
        extraKm: localDetails.extraKm,
        perKmRate: localDetails.perKmRate,
      },
    } : {}),
    // Intercity slab info
    ...(isIntercity ? {
      intercityDetail: {
        slab: getIntercitySlab(km),
        slabLabel: getSlabLabel(getIntercitySlab(km)),
        km: Math.round(km),
      },
    } : {}),
  };

  // ── Step 15: Build final result ───────────────────────────
  const warnings = [];
  if (capacityCheck.warning) warnings.push(capacityCheck.warning);

  return {
    valid: true,
    errors: [],
    warnings,

    breakdown,
    paymentOptions,

    recommendations: {
      vehicle:          recVehicle,
      helpers:          recHelpers,
      packingMaterials: recPacking,
      loadTimeMin:      loadTime,
      unloadTimeMin:    unloadTime,
      deliveryHours:    deliveryHrs,
    },

    capacityCheck,
    surchargesApplied: appliedSurcharges,

    finalTotal:  grandTotal,
    isIntercity,
    km:          Math.round(km),

    _internal,
  };
}


/* ============================================================
   SECTION 8 — DOM BRIDGE
   Reads the live form, calls calculateQuoteV2, updates UI.
   This is the ONLY place DOM is accessed.
   ============================================================ */

/**
 * Reads current form state and returns a raw input object.
 * Mirrors what the existing calculateQuote() reads.
 */
function _readFormState() {
  const g = id => document.getElementById(id);

  const furniture = {};
  for (const id of Object.keys(PRICING_CONFIG.furniturePrices)) {
    furniture[id] = parseInt(g(id)?.value ?? 0, 10) || 0;
  }

  let shiftHour = null;
  const timeVal = g("shiftTime")?.value;
  if (timeVal) {
    const match = timeVal.match(/^(\d{1,2}):/);
    if (match) shiftHour = parseInt(match[1], 10);
    // Handle "08:00" style time-slot values
    const parts = timeVal.split(":");
    if (parts.length >= 1) shiftHour = parseInt(parts[0], 10);
  }

  return {
    pickup:           g("pickup")?.value || "",
    drop:             g("drop")?.value   || "",
    km:               window._lastCalculatedKm || 0, // set by calculateQuote
    houseValue:       Number(g("house")?.value) || 0,
    vehicleHtmlValue: g("vehicle")?.value || "0",
    furniture,
    cartonQty:        parseInt(g("cartonQty")?.value ?? 0, 10) || 0,
    pickupFloor:      parseInt(g("pickupFloor")?.value ?? 0, 10) || 0,
    dropFloor:        parseInt(g("dropFloor")?.value  ?? 0, 10) || 0,
    liftAvailable:    !!g("liftAvailable")?.checked,
    moveType:         window.selectedMoveType || "home",
    shiftDate:        g("shiftDate")?.value || null,
    shiftHour,
    promoDiscount:    window.promoDiscount || 0,
  };
}

/**
 * Renders a detailed quote breakdown into the result div.
 * Called by the DOM bridge after calculateQuoteV2 runs.
 */
function _renderV2Breakdown(result, resultEl) {
  if (!resultEl) return;
  const { breakdown, isIntercity, km, warnings, recommendations: rec } = result;
  const fmt = n => Number(n).toLocaleString("en-IN");

  const rows = [];

  // Base
  if (isIntercity) {
    rows.push(`🚛 Intercity · ~${km} km (${breakdown.intercityDetail?.slabLabel || ""})`);
    rows.push(`Base Rate: ₹${fmt(breakdown.baseFare)}`);
  } else {
    rows.push(`📍 Local · ~${km.toFixed ? km.toFixed(1) : km} km`);
    rows.push(`Base Fare: ₹${fmt(breakdown.baseFare)}`);
    if (breakdown.distanceCharge > 0 && breakdown.localDetail) {
      rows.push(
        `Extra ${breakdown.localDetail.extraKm} km × ₹${breakdown.localDetail.perKmRate}: ₹${fmt(breakdown.distanceCharge)}`
      );
    }
  }

  if (breakdown.furnitureCharge > 0) rows.push(`Furniture: ₹${fmt(breakdown.furnitureCharge)}`);
  if (breakdown.cartonCharge    > 0) rows.push(`Cartons: ₹${fmt(breakdown.cartonCharge)}`);
  if (breakdown.floorCharge     > 0) rows.push(`Floor Charge: ₹${fmt(breakdown.floorCharge)}`);

  breakdown.surcharges?.forEach(s => {
    rows.push(`${s.label} (+${s.percent}%): ₹${fmt(s.amount)}`);
  });

  if (breakdown.gstInclusive) {
    rows.push(`GST ${PRICING_CONFIG.gst.rate}% (incl.): ₹${fmt(breakdown.gstAmount)}`);
  }

  if (breakdown.discount > 0) {
    rows.push(`Discount: −₹${fmt(breakdown.discount)}`);
  }

  rows.push(`<strong>Total Estimate: ₹${fmt(breakdown.grandTotal)}</strong>`);

  // Recommendations (subtle)
  if (rec?.vehicle) {
    rows.push(`💡 Recommended: ${rec.vehicle.icon} ${rec.vehicle.name} · ${rec.helpers} helpers`);
  }

  if (warnings.length > 0) {
    rows.push(`⚠️ ${warnings.join(" | ")}`);
  }

  resultEl.innerHTML = rows.join("<br>");
}


/* ============================================================
   SECTION 9 — LEGACY BRIDGE PATCH
   Patches the existing calculateQuote() function to also
   run the v2 engine in parallel and write the same
   lastCalculatedTotal. Fully backward compatible.
   ============================================================ */

/**
 * Called from within the existing applyPrice(km) closure.
 * We hook into it by storing km globally, then the existing
 * updatePriceDisplay() picks up lastCalculatedTotal as before.
 *
 * The v2 engine enhances the breakdown display and stores
 * the full QuoteResult on window._lastQuoteResult for
 * future admin dashboard / WhatsApp automation use.
 */
function runPricingEngineV2(km) {
  // Store km globally so _readFormState can access it
  window._lastCalculatedKm = km;

  const raw    = _readFormState();
  raw.km       = km;
  const result = calculateQuoteV2(raw);

  // Store full result for admin dashboard / automation
  window._lastQuoteResult = result;

  // Show capacity warnings inline
  if (result.warnings && result.warnings.length > 0) {
    const warnEl = document.getElementById("vehicleCapacityWarning");
    if (warnEl) {
      warnEl.textContent = result.warnings[0];
      warnEl.style.display = "block";
    }
  } else {
    const warnEl = document.getElementById("vehicleCapacityWarning");
    if (warnEl) warnEl.style.display = "none";
  }

  // Render enhanced breakdown
  const resultEl = document.getElementById("result");
  if (resultEl && result.valid) {
    _renderV2Breakdown(result, resultEl);
  }

  // Return for chaining / testing
  return result;
}


/* ============================================================
   SECTION 10 — UTILITY HELPERS
   ============================================================ */

/** Finds a vehicle config by its HTML option value. */
function _vehicleByHtmlValue(htmlValue) {
  return Object.values(VEHICLE_CONFIG).find(v => v.htmlValue === String(htmlValue)) || null;
}

/** Finds the best vehicle upgrade for a given house value. */
function _recommendVehicleForHouse(houseValue, moveType) {
  for (const id of VEHICLE_ORDER) {
    const v = VEHICLE_CONFIG[id];
    if (
      houseValue <= v.maxHouseValue &&
      (v.moveTypes.includes(moveType) || moveType === "single")
    ) {
      return v;
    }
  }
  return VEHICLE_CONFIG[VEHICLE_ORDER[VEHICLE_ORDER.length - 1]];
}

/** Returns an error-shaped QuoteResult. */
function _errorResult(errors) {
  return {
    valid:   false,
    errors,
    warnings: [],
    breakdown:      null,
    paymentOptions: null,
    recommendations: null,
    capacityCheck:  null,
    surchargesApplied: [],
    finalTotal: 0,
    isIntercity: false,
    km: 0,
    _internal: { operCost: 0, profit: 0, profitPercent: 0, engineVersion: PRICING_CONFIG.version },
  };
}


/* ============================================================
   SECTION 11 — PUBLIC API
   Expose a clean namespace on window.PackZenPricing
   ============================================================ */

window.PackZenPricing = {
  version:             PRICING_CONFIG.version,

  // Config (read-only reference — edit the const above)
  config:              PRICING_CONFIG,
  vehicles:            VEHICLE_CONFIG,

  // Core API
  calculateQuote:      calculateQuoteV2,
  validateInput:       validateQuoteInput,
  validateCapacity:    validateVehicleCapacity,

  // Sub-calculators (useful for unit tests)
  calcFurnitureCost,
  calcCartonCost,
  calcFloorCost,
  calcLocalDistanceFare,
  calcIntercityBase,
  applySurcharges,
  applyPromoDiscount,
  calcPaymentOptions,
  calcInternalProfit,

  // Recommendation engine
  recommendVehicle,
  recommendHelpers,
  recommendPackingMaterials,
  estimateDeliveryHours,

  // DOM bridge (called from within existing calculateQuote)
  runPricingEngineV2,

  // Helpers
  getIntercitySlab,
  getSlabLabel,
};

console.log(
  `%c✅ PackZen Pricing Engine v${PRICING_CONFIG.version} loaded`,
  "color:#22c55e;font-weight:700"
);

/* ============================================================
   END OF PRICING ENGINE v2.0
   ============================================================ */
