const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Load script.js from the root directory
const scriptPath = path.join(__dirname, '..', 'script.js');
const code = fs.readFileSync(scriptPath, 'utf8');

const context = {
  window: { ENV: {}, location: { search: '' }, _firebase: {}, addEventListener: () => {} },
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } }),
    body: { appendChild: () => {}, classList: { add: () => {} } },
    addEventListener: () => {},
    head: { appendChild: () => {} }
  },
  navigator: { geolocation: {} },
  setTimeout: () => {},
  clearTimeout: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  IntersectionObserver: class { observe() {} unobserve() {} },
  MutationObserver: class { observe() {} },
  URLSearchParams: URLSearchParams,
  performance: performance,
  requestAnimationFrame: () => {},
  console: { ...console }, // Optional: redirect logs if needed
  Math: Math,
  Date: Date,
  String: String,
  Number: Number,
  Array: Array,
  Object: Object,
  Promise: Promise,
  Error: Error,
  parseInt: parseInt,
  isNaN: isNaN,
  google: { maps: {} },
  firebase: {
    auth: { Auth: { Persistence: { LOCAL: 'local' } } },
    app: () => ({ options: {} }),
    initializeApp: () => ({ auth: () => ({ createUserWithEmailAndPassword: async () => ({ user: { uid: '123' } }), signOut: async () => {} }), delete: async () => {} }),
    firestore: { FieldValue: { serverTimestamp: () => {} } }
  },
  FileReader: class { readAsDataURL() {} }
};

vm.createContext(context);
vm.runInContext(code, context);

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` ${message}`);
      passed++;
    } else {
      console.error(` ${message}`);
      failed++;
    }
  }

  console.log('--- Testing checkRateLimit ---');

  // get the variables out of the vm
  const rateLimits = vm.runInContext('rateLimits', context);
  const checkRateLimit = vm.runInContext('checkRateLimit', context);

  // Clear existing limits for tests
  for (let key in rateLimits) delete rateLimits[key];

  // Test 1: First request should be allowed
  assert(checkRateLimit('test_key_1', 2, 1000) === true, 'First request should be allowed');

  // Test 2: Second request within window and under limit should be allowed
  assert(checkRateLimit('test_key_1', 2, 1000) === true, 'Second request should be allowed');

  // Test 3: Third request within window and over limit should be denied
  assert(checkRateLimit('test_key_1', 2, 1000) === false, 'Third request should be denied (limit exceeded)');

  // Test 4: Reset state and test new window
  rateLimits['test_key_2'] = { count: 2, firstRequest: Date.now() - 2000 };
  assert(checkRateLimit('test_key_2', 2, 1000) === true, 'Request after window expiry should reset and be allowed');

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
