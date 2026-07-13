console.log("Running all tests...");
try {
  require('child_process').execSync('node tests/test_pzEsc.js', { stdio: 'inherit' });
  console.log("Testing complete");
} catch (e) {
  process.exit(1);
}
