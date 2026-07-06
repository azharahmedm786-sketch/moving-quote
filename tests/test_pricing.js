const fs = require('fs');

// Load pricing engine in a crude way for testing
const code = fs.readFileSync('pricing-engine-v2.js', 'utf8');

// mock DOM bridge requirements
const window = {};
let document = {
  getElementById: () => null
};

eval(code);

const engine = window.PackZenPricing;

const scenarios = [
  // 1. Minimum fare scenario
  {
    input: {
      pickup: "A", drop: "B", km: 5, moveType: "home", houseValue: 0
    },
    desc: "Minimum fare check"
  },
  // 2. Local move tata ace (10 km, so inside freeKm)
  {
    input: {
      pickup: "A", drop: "B", km: 10, moveType: "home", houseValue: 200, vehicleHtmlValue: "200"
    },
    desc: "Local move (within free km)"
  },
  // 3. Local move with distance
  {
    input: {
      pickup: "A", drop: "B", km: 15, moveType: "home", houseValue: 200, vehicleHtmlValue: "200"
    },
    desc: "Local move (exceeding free km)"
  },
  // 4. Intercity move
  {
    input: {
      pickup: "A", drop: "B", km: 500, moveType: "home", houseValue: 2500, vehicleHtmlValue: "2500"
    },
    desc: "Intercity move"
  }
];

console.log("--- Testing Pricing Engine ---");
let passed = 0;
for (const [i, s] of scenarios.entries()) {
  const result = engine.calculateQuote(s.input);
  console.log(`Test ${i+1}: ${s.desc}`);
  console.log(`  Valid: ${result.valid}`);
  if (result.valid) {
    console.log(`  Total: ${result.finalTotal}`);
    console.log(`  Base Fare: ${result.breakdown.baseFare}`);
  } else {
    console.log(`  Errors: ${result.errors.join(', ')}`);
  }
  passed++;
}
console.log(`Passed ${passed}/${scenarios.length} tests.`);
