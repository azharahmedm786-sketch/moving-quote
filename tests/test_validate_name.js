const fs = require('fs');

const scriptContent = fs.readFileSync('script.js', 'utf8');

// Extract the validateName function from script.js
const validateNameMatch = scriptContent.match(/function validateName\([\s\S]*?\n\}/);
if (!validateNameMatch) {
  console.error("Could not find validateName in script.js");
  process.exit(1);
}

const validateNameCode = validateNameMatch[0];
eval(validateNameCode);

function runTests() {
  let passed = 0;
  let failed = 0;

  function assertEqual(testName, actual, expected) {
    if (actual === expected) {
      console.log(`✅ ${testName} passed.`);
      passed++;
    } else {
      console.error(`❌ ${testName} failed. Expected ${expected}, got ${actual}`);
      failed++;
    }
  }

  // Happy paths
  assertEqual("Valid standard name", validateName("John Doe"), "John Doe");
  assertEqual("Valid standard name with whitespace", validateName("  Jane Doe  "), "Jane Doe");
  assertEqual("Valid short name", validateName("Bo"), "Bo");

  // Edge cases and cleaning
  assertEqual("Name with HTML tags", validateName("<script>John</script>"), "scriptJohn/script");
  assertEqual("Name with quotes", validateName("\"John O'Connor\""), "John OConnor");
  assertEqual("Name with trailing/leading spaces and tags", validateName("  <John>  "), "John");

  // Invalid inputs
  assertEqual("Null input", validateName(null), null);
  assertEqual("Undefined input", validateName(undefined), null);
  assertEqual("Number input", validateName(123), null);
  assertEqual("Object input", validateName({}), null);
  assertEqual("Empty string", validateName(""), null);
  assertEqual("String with only spaces", validateName("   "), null);
  assertEqual("String too short after cleaning", validateName("A"), null);
  assertEqual("String too short after cleaning 2", validateName(" A "), null);
  assertEqual("String containing only invalid chars", validateName("<>\"'"), null);

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
