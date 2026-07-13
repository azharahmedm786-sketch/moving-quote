const fs = require('fs');

global.window = {
  location: { search: '' },
  addEventListener: () => {}
};
global.document = {
  querySelector: () => null,
  getElementById: () => null,
  createElement: () => ({ classList: { add: () => {} } }),
  body: { appendChild: () => {} },
  addEventListener: () => {}
};
global.URLSearchParams = class { get() { return null; } };
global.navigator = { userAgent: '' };

const code = fs.readFileSync('partner.js', 'utf8');
eval(code);

let failed = false;

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ ${testName} passed.`);
  } else {
    console.error(`❌ ${testName} failed. Expected "${expected}", but got "${actual}".`);
    failed = true;
  }
}

// 1. Falsy input
assertEqual(pzDate(null), "--", "pzDate with null returns '--'");
assertEqual(pzDate(undefined), "--", "pzDate with undefined returns '--'");

// 2. Mock Firestore timestamp
const mockTimestamp = {
  toDate: () => new Date('2023-10-15T10:00:00Z')
};
assertEqual(pzDate(mockTimestamp), "15 Oct 2023", "pzDate with Firestore timestamp");

// 3. Date object
assertEqual(pzDate(new Date('2023-10-15T10:00:00Z')), "15 Oct 2023", "pzDate with Date object");

// 4. Valid string
assertEqual(pzDate('2023-10-15T10:00:00Z'), "15 Oct 2023", "pzDate with valid date string");

// 5. Valid number
assertEqual(pzDate(new Date('2023-10-15T10:00:00Z').getTime()), "15 Oct 2023", "pzDate with valid number");

// 6. Invalid date
assertEqual(pzDate('invalid-date-string'), "--", "pzDate with invalid date string");
assertEqual(pzDate(new Date('invalid')), "--", "pzDate with invalid Date object");

// 7. Custom options
assertEqual(pzDate('2023-10-15T10:00:00Z', { day: "numeric", month: "long", year: "numeric" }), "15 October 2023", "pzDate with custom options");

if (failed) {
  process.exit(1);
}
