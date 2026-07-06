const fs = require('fs');

// Load pricing engine in a crude way for testing
const code = fs.readFileSync('pricing-engine-v2.js', 'utf8');
const window = {};
let document = { getElementById: () => null };
eval(code);
const engine = window.PackZenPricing;

const distances = [5, 12, 45, 120, 500, 1500];
const houseValues = [0, 200, 2500, 6500, 13500];
const moveTypes = ["home", "office", "single"];
const timeSlots = [10, 14, 22]; // 22 is night surcharge
const isWeekends = [false, true];
const liftAvailabilities = [true, false];
const packingFlags = [false, true];

const scenarios = [];

for (const km of distances) {
  for (const houseValue of houseValues) {
    for (const moveType of moveTypes) {
      if (moveType === "single" && houseValue !== 0) continue;
      if (moveType !== "single" && houseValue === 0) continue;

      const isIntercity = km > 100;
      if (isIntercity && moveType === "single") continue;

      for (const shiftHour of timeSlots) {
        for (const isWeekend of isWeekends) {
          for (const liftAvailable of liftAvailabilities) {
             for (const packingService of packingFlags) {

                // create a mock date for weekend
                const shiftDate = new Date();
                shiftDate.setFullYear(shiftDate.getFullYear() + 1); // Next year to ensure not past
                if (isWeekend) {
                   while (shiftDate.getDay() !== 6) shiftDate.setDate(shiftDate.getDate() + 1); // Next Saturday
                } else {
                   while (shiftDate.getDay() === 0 || shiftDate.getDay() === 6) shiftDate.setDate(shiftDate.getDate() + 1); // Next Weekday
                }

                let vehicleHtmlValue = "0";
                if (houseValue <= 2500) vehicleHtmlValue = "200";
                else if (houseValue <= 6500) vehicleHtmlValue = "2500";
                else if (houseValue <= 10500) vehicleHtmlValue = "4000";
                else vehicleHtmlValue = "5500";

                scenarios.push({
                   input: {
                     pickup: "A", drop: "B",
                     km, houseValue, moveType,
                     shiftHour, shiftDate: shiftDate.toISOString().split("T")[0],
                     liftAvailable, packingService,
                     vehicleHtmlValue,
                     promoDiscount: 50000 // Huge discount to trigger protection
                   }
                });
             }
          }
        }
      }
    }
  }
}

console.log(`--- Running ${scenarios.length} scenarios ---`);
let passed = 0;
let underpriced = 0;

for (const [i, s] of scenarios.entries()) {
  const res = engine.calculateQuote(s.input);
  if (!res.valid) {
    console.log(`Scenario ${i+1} invalid: ${res.errors.join(", ")}`);
    continue;
  }

  const operCost = res._internal.operCost;
  const minRequiredTotal = Math.ceil(operCost * 1.1);
  const total = res.finalTotal;

  if (total < minRequiredTotal && res._internal.profitPercent < 10) {
     underpriced++;
     console.log(`Underpriced! Scenario ${i+1}: Total=${total}, OperCost=${operCost}, ExpectedMin=${minRequiredTotal}`);
  }
  passed++;
}

console.log(`Passed: ${passed}/${scenarios.length}`);
if (underpriced > 0) {
  console.log(`FAILED! ${underpriced} scenarios were underpriced.`);
  process.exit(1);
} else {
  console.log("All scenarios maintained >= 10% profit margin.");
}
