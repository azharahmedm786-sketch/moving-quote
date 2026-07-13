const fs = require('fs');

// Mock DOM
global.window = { addEventListener: () => {} };
global.document = {
  createElement: () => ({ classList: { add: () => {}, remove: () => {} }, appendChild: () => {} }),
  body: { appendChild: () => {} },
  querySelector: () => null,
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const code = fs.readFileSync('partner.js', 'utf8');
eval(code);

function test(name, errObj, expectedOutput) {
  const result = friendlyAuthError(errObj);
  if (result === expectedOutput) {
    console.log(`✅ ${name} passed.`);
  } else {
    console.error(`❌ ${name} failed. Expected "${expectedOutput}", got "${result}"`);
    process.exit(1);
  }
}

console.log("Testing friendlyAuthError...");

// Test scenarios
test("wrong-password", {code: "auth/wrong-password"}, "Incorrect email or password.");
test("invalid-credential", {code: "auth/invalid-credential"}, "Incorrect email or password.");
test("invalid-login-credentials", {code: "auth/invalid-login-credentials"}, "Incorrect email or password.");
test("user-not-found", {code: "auth/user-not-found"}, "No account found with this email.");
test("too-many-requests", {code: "auth/too-many-requests"}, "Too many attempts. Please try again later.");
test("network-request-failed", {code: "auth/network-request-failed"}, "Network error. Check your connection.");
test("user-disabled", {code: "auth/user-disabled"}, "This account has been disabled. Contact support.");

// Edge cases and fallbacks
test("unknown error code", {code: "auth/unknown-error"}, "Something went wrong. Please try again.");
test("null error object", null, "Something went wrong. Please try again.");
test("undefined error object", undefined, "Something went wrong. Please try again.");
test("error object without code", {message: "Some error"}, "Something went wrong. Please try again.");
test("empty error object", {}, "Something went wrong. Please try again.");
test("string instead of object", "error", "Something went wrong. Please try again.");
