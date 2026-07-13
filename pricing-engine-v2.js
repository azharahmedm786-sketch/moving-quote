/**
 * ============================================================
 * PackZen — Pricing Engine v2.0 (Redesigned)
 * ============================================================
 */

"use strict";

const PRICING_CONFIG = Object.freeze({
  version: "3.0.0",
  minimumFare: 1499,

  baseKm: 10,
  perKmRate: 25,

  vehicles: {
    tata_ace:   { baseFare: 1000, capacity: 40,  slabs: { quarter: 200, half: 400, threeQuarter: 600, full: 800 } },
    truck_14ft: { baseFare: 1500, capacity: 80,  slabs: { quarter: 300, half: 600, threeQuarter: 900, full: 1200 } },
    truck_17ft: { baseFare: 2000, capacity: 120, slabs: { quarter: 500, half: 1000, threeQuarter: 1500, full: 2000 } },
    truck_22ft: { baseFare: 3000, capacity: 180, slabs: { quarter: 750, half: 1500, threeQuarter: 2250, full: 3000 } },
  },

  furnitureUnits: {
    // Living Room
    sofaCheck: 10,
    sofaCumBedCheck: 15,
    reclinerCheck: 12,
    tvCheck: 2,
    tvUnitCheck: 8,
    coffeeCheck: 3,
    centerTableCheck: 5,
    bookshelfCheck: 10,
    showcaseCheck: 12,
    shoeRackCheck: 4,
    acCheck: 5,
    // Bedroom
    bedCheck: 8,
    mattressCheck: 5,
    wardrobeCheck: 15,
    dressingCheck: 8,
    sideTableCheck: 2,
    studyTableCheck: 6,
    // Kitchen
    fridgeCheck: 8,
    wmCheck: 6,
    dishwasherCheck: 8,
    microwaveCheck: 2,
    ovenCheck: 4,
    chimneyCheck: 5,
    diningCheck: 8,
    waterPurifierCheck: 2,
    // Office
    deskCheck: 8,
    chairCheck: 2,
    serverCheck: 15,
    printerCheck: 4,
    confCheck: 20,
    cabinetCheck: 10,
    whiteboardCheck: 3,
    // Others
    bikeCheck: 10,
    cycleCheck: 5,
    plantCheck: 2,
    gymCheck: 15,
    treadmillCheck: 15,
    aquariumCheck: 10
  },

  cartonUnit: 1,

  floor: {
    withLift: 100,
    withoutLift: 200
  },

  labour: {
    pricePerHelper: 400
  },

  packing: {
    pricePerUnit: 20
  },

  waiting: {
    pricePerHour: 300
  },

  longCarry: {
    pricePerMeter: 10
  },

  discounts: {
    maxPromoFraction: 0.5
  },

  taxes: {
    gstPercent: 18,
    enabled: false
  },

  payment: {
    advancePercent: 10,
    fullPaymentDiscount: 200
  }
});

const VEHICLE_CONFIG = Object.freeze({
  tata_ace: {
    id: "tata_ace", htmlValue: "200", name: "Tata Ace", icon: "<i data-lucide=circle></i>",
    sub: "Ideal for single items & 1 RK", displayRate: "From ₹1,999",
    minHouseValue: 0, maxHouseValue: 2500, moveTypes: ["home", "single"],
    helpers: 1, loadTimeMin: 45, unloadTimeMin: 30,
  },
  truck_14ft: {
    id: "truck_14ft", htmlValue: "2500", name: "14 ft Truck", icon: "<i data-lucide=truck></i>",
    sub: "Ideal for 1–2 BHK", displayRate: "From ₹4,500",
    minHouseValue: 2500, maxHouseValue: 6500, moveTypes: ["home", "office", "intercity"],
    helpers: 2, loadTimeMin: 90, unloadTimeMin: 60,
  },
  truck_17ft: {
    id: "truck_17ft", htmlValue: "4000", name: "17 ft Truck", icon: "<i data-lucide=truck></i>",
    sub: "Ideal for 2–3 BHK", displayRate: "From ₹6,000",
    minHouseValue: 6500, maxHouseValue: 10500, moveTypes: ["home", "office", "intercity"],
    helpers: 3, loadTimeMin: 150, unloadTimeMin: 120,
  },
  truck_22ft: {
    id: "truck_22ft", htmlValue: "5500", name: "22 ft Truck", icon: "<i data-lucide=circle></i>",
    sub: "Ideal for 3+ BHK", displayRate: "From ₹7,500",
    minHouseValue: 8500, maxHouseValue: Infinity, moveTypes: ["home", "office", "intercity"],
    helpers: 4, loadTimeMin: 240, unloadTimeMin: 180,
  }
});

const VEHICLE_ORDER = ["tata_ace", "truck_14ft", "truck_17ft", "truck_22ft"];

function _vehicleByHtmlValue(htmlValue) {
  return Object.values(VEHICLE_CONFIG).find(v => v.htmlValue === String(htmlValue)) || null;
}

function _recommendVehicleForHouse(houseValue, moveType) {
  for (const id of VEHICLE_ORDER) {
    const v = VEHICLE_CONFIG[id];
    if (houseValue <= v.maxHouseValue && (v.moveTypes.includes(moveType) || moveType === "single")) {
      return v;
    }
  }
  return VEHICLE_CONFIG[VEHICLE_ORDER[VEHICLE_ORDER.length - 1]];
}

function validateQuoteInput(raw) {
  const errors = [];
  if (!raw.pickup || typeof raw.pickup !== "string" || !raw.pickup.trim()) errors.push("Pickup location is required.");
  if (!raw.drop || typeof raw.drop !== "string" || !raw.drop.trim()) errors.push("Drop location is required.");

  const km = Number(raw.km);
  if (isNaN(km) || km < 0) errors.push("Distance (km) must be a non-negative number.");

  const houseValue = Number(raw.houseValue) || 0;
  if (houseValue < 0 || isNaN(houseValue)) errors.push("House/size value is invalid.");

  const vehicleHtmlValue = String(raw.vehicleHtmlValue || "0");
  let vehicleCfg = null;
  if (vehicleHtmlValue !== "0") {
    vehicleCfg = _vehicleByHtmlValue(vehicleHtmlValue);
    if (!vehicleCfg) errors.push(`Unknown vehicle value: ${vehicleHtmlValue}.`);
  }

  const furniture = {};
  for (const [id, units] of Object.entries(PRICING_CONFIG.furnitureUnits)) {
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

  const cartonQty = parseInt(raw.cartonQty ?? 0, 10);
  if (isNaN(cartonQty) || cartonQty < 0) errors.push("Carton quantity must be a non-negative integer.");
  else if (cartonQty > 50) errors.push("Carton quantity cannot exceed 50.");

  const pickupFloor = Math.max(0, parseInt(raw.pickupFloor ?? 0, 10) || 0);
  const dropFloor   = Math.max(0, parseInt(raw.dropFloor   ?? 0, 10) || 0);
  const liftAvail   = Boolean(raw.liftAvailable);

  const validTypes = ["home", "office", "single"];
  const moveType = validTypes.includes(raw.moveType) ? raw.moveType : "home";

  const data = {
    pickup: (raw.pickup || "").trim(),
    drop: (raw.drop || "").trim(),
    km: Math.max(0, km || 0),
    houseValue,
    vehicleHtmlValue,
    vehicleCfg,
    furniture,
    cartonQty: Math.min(50, Math.max(0, cartonQty || 0)),
    pickupFloor,
    dropFloor,
    liftAvailable: liftAvail,
    packingService: !!raw.packingService,
    moveType,
    promoDiscount: Math.max(0, Number(raw.promoDiscount) || 0),
    extraHelpers: Math.max(0, parseInt(raw.extraHelpers ?? 0, 10) || 0),
    waitingHours: Math.max(0, Number(raw.waitingHours) || 0),
    longCarryDistance: Math.max(0, Number(raw.longCarryDistance) || 0),
  };
  return { valid: errors.length === 0, errors, data };
}

/* ── INDEPENDENT PRICING MODULES ── */

function calcBaseVehicleCharge(vehicleCfg) {
  if (!vehicleCfg) return PRICING_CONFIG.minimumFare;
  const rates = PRICING_CONFIG.vehicles[vehicleCfg.id];
  return rates ? rates.baseFare : PRICING_CONFIG.minimumFare;
}

function calcDistanceCharge(km) {
  const extraKm = Math.max(0, km - PRICING_CONFIG.baseKm);
  return Math.round(extraKm * PRICING_CONFIG.perKmRate);
}

function calcCapacityCharge(furniture, cartonQty, vehicleCfg) {
  if (!vehicleCfg) return { totalUnits: 0, capacityUsed: 0, capacityCharge: 0, slab: "None", warning: null, recommendation: null };

  let totalUnits = 0;
  for (const [id, qty] of Object.entries(furniture)) {
    if (qty > 0) {
      totalUnits += qty * (PRICING_CONFIG.furnitureUnits[id] || 0);
    }
  }
  totalUnits += cartonQty * PRICING_CONFIG.cartonUnit;

  const rates = PRICING_CONFIG.vehicles[vehicleCfg.id];
  if (!rates) return { totalUnits, capacityUsed: 0, capacityCharge: 0, slab: "None", warning: null, recommendation: null };

  const capacityUsed = (totalUnits / rates.capacity) * 100;

  let slab = "Full Load";
  let capacityCharge = rates.slabs.full;
  if (capacityUsed <= 25) {
    slab = "Quarter Load";
    capacityCharge = rates.slabs.quarter;
  } else if (capacityUsed <= 50) {
    slab = "Half Load";
    capacityCharge = rates.slabs.half;
  } else if (capacityUsed <= 75) {
    slab = "Three Quarter Load";
    capacityCharge = rates.slabs.threeQuarter;
  }

  let warning = null;
  let recommendation = null;
  if (capacityUsed > 100) {
    const idx = VEHICLE_ORDER.indexOf(vehicleCfg.id);
    if (idx >= 0 && idx < VEHICLE_ORDER.length - 1) {
      const nextVehicle = VEHICLE_CONFIG[VEHICLE_ORDER[idx + 1]];
      recommendation = nextVehicle;
      warning = `<i data-lucide=triangle-alert></i> Capacity exceeds 100% (${Math.round(capacityUsed)}%). We recommend upgrading to ${nextVehicle.name} for adequate space.`;
    } else {
      warning = `<i data-lucide=triangle-alert></i> Capacity exceeds 100% (${Math.round(capacityUsed)}%). Multiple trips or an extra vehicle may be required.`;
    }
  }

  return { totalUnits, capacityUsed, capacityCharge, slab, warning, recommendation };
}

function calcFloorCharge(pickupFloor, dropFloor, liftAvailable) {
  const totalFloors = pickupFloor + dropFloor;
  if (totalFloors === 0) return 0;
  const rate = liftAvailable ? PRICING_CONFIG.floor.withLift : PRICING_CONFIG.floor.withoutLift;
  return totalFloors * rate;
}

function calcLabourCharge(vehicleCfg, extraHelpers) {
  const baseHelpers = vehicleCfg ? vehicleCfg.helpers : 0;
  const totalHelpers = baseHelpers + extraHelpers;
  return totalHelpers * PRICING_CONFIG.labour.pricePerHelper;
}

function calcPackingCharge(packingService, totalUnits) {
  if (!packingService) return 0;
  return totalUnits * PRICING_CONFIG.packing.pricePerUnit;
}

function calcWaitingCharge(waitingHours) {
  return waitingHours * PRICING_CONFIG.waiting.pricePerHour;
}

function calcLongCarryCharge(longCarryDistance) {
  return longCarryDistance * PRICING_CONFIG.longCarry.pricePerMeter;
}

function calcDiscount(total, promoDiscount) {
  const maxDiscount = Math.floor(total * PRICING_CONFIG.discounts.maxPromoFraction);
  return Math.min(promoDiscount, maxDiscount);
}

function calcTaxes(total) {
  if (!PRICING_CONFIG.taxes.enabled) return { gstAmount: 0, gstInclusive: false };
  const gstAmount = Math.round(total * (PRICING_CONFIG.taxes.gstPercent / 100));
  return { gstAmount, gstInclusive: false };
}

function calculateQuoteV2(raw) {
  const { valid, errors, data } = validateQuoteInput(raw);
  if (!valid) return _errorResult(errors);

  const {
    km, vehicleCfg, furniture, cartonQty, pickupFloor, dropFloor, liftAvailable,
    packingService, promoDiscount: rawPromo, extraHelpers, waitingHours, longCarryDistance, houseValue, moveType
  } = data;

  const baseFare = calcBaseVehicleCharge(vehicleCfg);
  const distanceCharge = vehicleCfg ? calcDistanceCharge(km) : 0;

  const capResult = calcCapacityCharge(furniture, cartonQty, vehicleCfg);
  const vehicleCapacityCharge = capResult.capacityCharge;

  const floorCharge = calcFloorCharge(pickupFloor, dropFloor, liftAvailable);
  const labourCharge = calcLabourCharge(vehicleCfg, extraHelpers);
  const packingCharge = calcPackingCharge(packingService, capResult.totalUnits);
  const waitingCharge = calcWaitingCharge(waitingHours);
  const longCarryCharge = calcLongCarryCharge(longCarryDistance);

  const subtotal = baseFare + distanceCharge + vehicleCapacityCharge + floorCharge + labourCharge + packingCharge + waitingCharge + longCarryCharge;
  const { gstAmount, gstInclusive } = calcTaxes(subtotal);
  const totalBeforeDiscount = Math.max(subtotal + (gstInclusive ? 0 : gstAmount), PRICING_CONFIG.minimumFare);

  let cappedDiscount = calcDiscount(totalBeforeDiscount, rawPromo);
  let grandTotal = Math.max(totalBeforeDiscount - cappedDiscount, PRICING_CONFIG.minimumFare);

  const breakdown = {
    baseFare,
    distanceCharge,
    capacityCharge: vehicleCapacityCharge,
    floorCharge,
    labourCharge,
    packingCharge,
    waitingCharge,
    longCarryCharge,
    subtotal,
    gstAmount,
    gstInclusive,
    discount: cappedDiscount,
    grandTotal,
    capacityDetail: {
      totalUnits: capResult.totalUnits,
      capacityUsed: capResult.capacityUsed,
      slab: capResult.slab
    }
  };

  const advanceAmount = Math.round(grandTotal * (PRICING_CONFIG.payment.advancePercent / 100));
  const fullOnlineAmount = Math.max(grandTotal - PRICING_CONFIG.payment.fullPaymentDiscount, 0);
  const paymentOptions = {
    atDropAmount: grandTotal,
    advanceAmount,
    fullOnlineAmount,
    fullOnlineSaving: PRICING_CONFIG.payment.fullPaymentDiscount
  };

  const warnings = [];
  if (capResult.warning) warnings.push(capResult.warning);

  return {
    valid: true,
    errors: [],
    warnings,
    breakdown,
    paymentOptions,
    recommendations: {
      vehicle: capResult.recommendation || _recommendVehicleForHouse(houseValue, moveType),
      helpers: vehicleCfg ? vehicleCfg.helpers + extraHelpers : extraHelpers,
      packingMaterials: [],
      loadTimeMin: vehicleCfg ? vehicleCfg.loadTimeMin : 0,
      unloadTimeMin: vehicleCfg ? vehicleCfg.unloadTimeMin : 0,
      deliveryHours: null
    },
    capacityCheck: { ok: !capResult.warning, warning: capResult.warning, recommended: capResult.recommendation },
    surchargesApplied: [],
    finalTotal: grandTotal,
    isIntercity: false,
    km: Math.round(km),
    _internal: { operCost: 0, profit: 0, profitPercent: 0, engineVersion: PRICING_CONFIG.version }
  };
}

function _errorResult(errors) {
  return {
    valid: false, errors, warnings: [], breakdown: null, paymentOptions: null,
    recommendations: null, capacityCheck: null, surchargesApplied: [], finalTotal: 0,
    isIntercity: false, km: 0, _internal: {}
  };
}

function _readFormState() {
  const g = id => document.getElementById(id);
  const furniture = {};
  for (const id of Object.keys(PRICING_CONFIG.furnitureUnits)) {
    furniture[id] = parseInt(g(id)?.value ?? 0, 10) || 0;
  }
  return {
    pickup: g("pickup")?.value || "",
    drop: g("drop")?.value || "",
    km: window._lastCalculatedKm || 0,
    houseValue: Number(g("house")?.value) || 0,
    vehicleHtmlValue: g("vehicle")?.value || "0",
    extraHelpers: parseInt(g("extraHelpers")?.value ?? 0, 10) || 0,
    waitingHours: Number(g("waitingHours")?.value) || 0,
    longCarryDistance: Number(g("longCarryDistance")?.value) || 0,
    furniture,
    cartonQty: parseInt(g("cartonQty")?.value ?? 0, 10) || 0,
    pickupFloor: parseInt(g("pickupFloor")?.value ?? 0, 10) || 0,
    dropFloor: parseInt(g("dropFloor")?.value ?? 0, 10) || 0,
    liftAvailable: !!g("liftAvailable")?.checked,
    packingService: !!(g("packingService")?.checked || window._packingServiceRequested),
    moveType: window.selectedMoveType || "home",
    promoDiscount: window.promoDiscount || 0,
  };
}

function _renderV2Breakdown(result, resultEl) {
  if (!resultEl) return;
  const { breakdown, km, warnings, recommendations: rec } = result;
  const fmt = n => Number(n).toLocaleString("en-IN");
  const rows = [];

  rows.push(`<i data-lucide=map-pin></i> Local · ~${km.toFixed ? km.toFixed(1) : km} km`);
  rows.push(`Base Vehicle: ₹${fmt(breakdown.baseFare)}`);
  if (breakdown.distanceCharge > 0) rows.push(`Distance Charge: ₹${fmt(breakdown.distanceCharge)}`);
  if (breakdown.capacityCharge > 0) rows.push(`Vehicle Capacity (${breakdown.capacityDetail.slab} - ${Math.round(breakdown.capacityDetail.capacityUsed)}%): ₹${fmt(breakdown.capacityCharge)}`);
  if (breakdown.floorCharge > 0) rows.push(`Floor Charge: ₹${fmt(breakdown.floorCharge)}`);
  if (breakdown.labourCharge > 0) rows.push(`Labour Charge: ₹${fmt(breakdown.labourCharge)}`);
  if (breakdown.packingCharge > 0) rows.push(`Packing Charge: ₹${fmt(breakdown.packingCharge)}`);
  if (breakdown.waitingCharge > 0) rows.push(`Waiting Charge: ₹${fmt(breakdown.waitingCharge)}`);
  if (breakdown.longCarryCharge > 0) rows.push(`Long Carry Charge: ₹${fmt(breakdown.longCarryCharge)}`);

  if (breakdown.discount > 0) rows.push(`Discount: −₹${fmt(breakdown.discount)}`);
  if (breakdown.gstAmount > 0) rows.push(`GST (${PRICING_CONFIG.taxes.gstPercent}%): ₹${fmt(breakdown.gstAmount)}`);

  rows.push(`<strong>Grand Total: ₹${fmt(breakdown.grandTotal)}</strong>`);

  if (warnings.length > 0) {
    rows.push(`<i data-lucide=triangle-alert></i> ${warnings.join(" | ")}`);
  }

  resultEl.innerHTML = rows.join("<br>");
}

function runPricingEngineV2(km) {
  window._lastCalculatedKm = km;
  const raw = _readFormState();
  raw.km = km;
  const result = calculateQuoteV2(raw);
  window._lastQuoteResult = result;

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

  const resultEl = document.getElementById("result");
  if (resultEl && result.valid) {
    _renderV2Breakdown(result, resultEl);
  }
  return result;
}

window.PackZenPricing = {
  version: PRICING_CONFIG.version,
  config: PRICING_CONFIG,
  vehicles: VEHICLE_CONFIG,
  calculateQuote: calculateQuoteV2,
  validateInput: validateQuoteInput,
  runPricingEngineV2,
};
