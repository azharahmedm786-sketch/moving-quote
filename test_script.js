console.log("Running basic test suite...");
require('child_process').execSync('node tests/test_validate_phone.js', { stdio: 'inherit' });
console.log("Testing complete");
