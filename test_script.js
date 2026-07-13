const { execSync } = require('child_process');

console.log("Running all tests...");

try {
  execSync('node tests/test_escapeHTML.js', { stdio: 'inherit' });
  execSync('node tests/test_pricing.js', { stdio: 'inherit' });
  execSync('node tests/test_50_scenarios.js', { stdio: 'inherit' });
  console.log("\n✅ All tests passed successfully.");
} catch (error) {
  console.error("\n❌ Some tests failed.");
  process.exit(1);
}
