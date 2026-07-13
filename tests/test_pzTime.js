const fs = require('fs');

// Mock window and document to allow partner.js to load
global.window = {
  addEventListener: () => {},
  location: { search: '' }
};
global.document = {
  createElement: () => ({ classList: { add: () => {}, remove: () => {} } }),
  querySelector: () => null,
  body: { appendChild: () => {} },
  addEventListener: () => {}
};
global.setTimeout = () => {};
global.clearTimeout = () => {};

// Load script
const code = fs.readFileSync('partner.js', 'utf8');
eval(code);

let testsRun = 0;
let testsPassed = 0;

function testEq(name, actual, expected) {
  testsRun++;
  if (actual === expected) {
    testsPassed++;
    console.log(`✅ ${name} passed.`);
  } else {
    console.error(`❌ ${name} failed. Expected '${expected}' but got '${actual}'.`);
  }
}

function runTests() {
  console.log("Testing pzTime");

  // Test 1: Null input
  testEq("null input", pzTime(null), "");

  // Test 2: Undefined input
  testEq("undefined input", pzTime(undefined), "");

  // Test 3: Standard JS Date object
  const d1 = new Date('2023-01-01T14:30:00Z');
  const d1Formatted = d1.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  testEq("Date object", pzTime(d1), d1Formatted);

  // Test 4: Firestore timestamp mock (object with toDate method)
  const d2 = { toDate: () => new Date('2023-01-01T09:15:00Z') };
  const d2Date = d2.toDate();
  const d2Formatted = d2Date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  testEq("Firestore timestamp mock", pzTime(d2), d2Formatted);

  // Test 5: Invalid date string
  testEq("Invalid date string", pzTime('not a date'), "");

  // Test 6: Valid date string
  const d3String = '2023-01-01T10:00:00Z';
  const d3Date = new Date(d3String);
  const d3Formatted = d3Date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  testEq("Valid date string", pzTime(d3String), d3Formatted);

  // Summary
  if (testsPassed === testsRun) {
    console.log(`All ${testsPassed} pzTime tests passed.`);
  } else {
    console.error(`${testsRun - testsPassed} tests failed.`);
    process.exit(1);
  }
}

runTests();
