const fs = require('fs');
const assert = require('assert');

// Mock window and document since partner.js is meant for the browser
global.window = {
  location: { search: '' },
  addEventListener: () => {}
};
global.document = {
  getElementById: (id) => null,
  createElement: () => ({ classList: { add: () => {}, remove: () => {} }, appendChild: () => {} }),
  body: { appendChild: () => {}, dataset: {} },
  addEventListener: () => {}
};
global.URLSearchParams = class {
  constructor() {}
  get() { return null; }
};

// Load and evaluate script
const code = fs.readFileSync('partner.js', 'utf8');
eval(code);

function testPzMoney() {
  console.log("Running pzMoney tests...");

  // 1. Normal number
  assert.strictEqual(pzMoney(1000), "₹1,000", "Should format 1000 correctly");

  // 2. String representation of number
  assert.strictEqual(pzMoney("2500"), "₹2,500", "Should format string '2500' correctly");

  // 3. Zero
  assert.strictEqual(pzMoney(0), "₹0", "Should format 0 correctly");
  assert.strictEqual(pzMoney("0"), "₹0", "Should format string '0' correctly");

  // 4. Large number
  assert.strictEqual(pzMoney(1000000), "₹10,00,000", "Should format 1 million correctly in INR style");

  // 5. Invalid inputs, should default to 0
  assert.strictEqual(pzMoney(null), "₹0", "Should default to 0 for null");
  assert.strictEqual(pzMoney(undefined), "₹0", "Should default to 0 for undefined");
  assert.strictEqual(pzMoney("abc"), "₹0", "Should default to 0 for invalid string");
  assert.strictEqual(pzMoney(NaN), "₹0", "Should default to 0 for NaN");

  // 6. Floating point (rounds to 0 decimal places according to en-IN with maximumFractionDigits: 0)
  assert.strictEqual(pzMoney(1234.5), "₹1,235", "Should round float (half up usually based on environment, but JS engine-dependent)");
  assert.strictEqual(pzMoney(1234.2), "₹1,234", "Should round down float");

  console.log(" pzMoney tests passed!");
}

testPzMoney();
