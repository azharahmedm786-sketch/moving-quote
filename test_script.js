console.log("Running all tests...");
require('child_process').execSync('node tests/test_pricing.js', { stdio: 'inherit' });
require('child_process').execSync('node tests/test_pzTime.js', { stdio: 'inherit' });
console.log("Testing complete");
