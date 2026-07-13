const { execSync } = require('child_process');

function runTest(file) {
  console.log(`Running ${file}...`);
  try {
    execSync(`node ${file}`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Test ${file} failed.`);
    process.exit(1);
  }
}

// Add the new test for friendlyAuthError
runTest('tests/test_partner_auth_error.js');

console.log("Testing complete");
