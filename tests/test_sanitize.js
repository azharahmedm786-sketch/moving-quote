const fs = require('fs');

// Mock browser environment required to evaluate script.js
global.window = {
  location: { search: '' },
  addEventListener: () => {},
  scrollTo: () => {}
};
global.document = {
  getElementById: () => ({
    addEventListener: () => {},
    style: {},
    classList: { add: ()=>{}, remove: ()=>{} },
    contains: () => false
  }),
  addEventListener: () => {},
  querySelector: () => ({
    style: {},
    classList: { add: ()=>{}, remove: ()=>{} },
    contains: () => false
  }),
  querySelectorAll: () => []
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.navigator = {
  userAgent: '',
  geolocation: { getCurrentPosition: () => {} }
};

// Load and evaluate script.js
const code = fs.readFileSync('script.js', 'utf8');
try {
  eval(code);
} catch (e) {
  console.error("Failed to evaluate script.js in test environment:", e);
  process.exit(1);
}

// Test runner function
function test(name, input, expected) {
  try {
    const result = sanitizeInput(input);
    if (result === expected) {
      console.log(`✅ ${name} passed.`);
    } else {
      console.error(`❌ ${name} failed. Expected "${expected}", got "${result}"`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`❌ ${name} threw an error: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log("Running sanitizeInput tests...");

// 1. Happy path: standard string without special characters
test("Happy path", "John Doe", "John Doe");

// 2. Trimming: string with leading/trailing spaces
test("Trimming whitespace", "  Hello World  ", "Hello World");

// 3. Stripping specific characters: < > " '
test("Strip special chars", "<script>alert('xss')</script>", "scriptalert(xss)/script");
test("Strip quotes", `"Quoted" and 'Single'`, "Quoted and Single");
test("Complex string", '  <img src="x" onerror="alert(1)">  ', "img src=x onerror=alert(1)");

// 4. Edge cases
test("Null input", null, "");
test("Undefined input", undefined, "");
test("Number input (non-string)", 12345, "");
test("Boolean input (non-string)", true, "");
test("Object input (non-string)", { text: "hello" }, "");
test("Empty string", "", "");

if (process.exitCode === 1) {
  console.error("Some tests failed.");
  process.exit(1);
} else {
  console.log("All sanitizeInput tests passed successfully!");
}
