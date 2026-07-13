const fs = require('fs');
global.window = {};
global.document = { getElementById: () => null };

// Load script in node environment safely by mocking enough objects
// but since evaluating the entire script.js might be problematic
// we can extract the function using a more robust mechanism
const code = fs.readFileSync('script.js', 'utf8');

// Find the function and extract it.
// Assuming the function starts with 'function validatePhone' and we just find the matching braces
let startIdx = code.indexOf('function validatePhone');
if (startIdx === -1) {
    console.error("Could not find validatePhone in script.js");
    process.exit(1);
}

let braceCount = 0;
let started = false;
let endIdx = startIdx;

for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') {
        started = true;
        braceCount++;
    } else if (code[i] === '}') {
        braceCount--;
    }

    if (started && braceCount === 0) {
        endIdx = i;
        break;
    }
}

const functionCode = code.substring(startIdx, endIdx + 1);

eval(functionCode);


let failures = 0, passes = 0;
function runTest(name, input, expected) {
  const result = validatePhone(input);
  if (result === expected) { passes++; console.log(`✅ [PASS] ${name}`); }
  else { failures++; console.error(`❌ [FAIL] ${name} | Input: "${input}" | Expected: ${expected} | Got: ${result}`); }
}
runTest("10-digit number", "1234567890", "1234567890");
runTest("10-digit number with spaces", "123 456 7890", "1234567890");
runTest("10-digit number with dashes", "123-456-7890", "1234567890");
runTest("10-digit number with parentheses", "(123) 456-7890", "1234567890");
runTest("Empty string", "", null);
runTest("Null", null, null);
runTest("9-digit number (too short)", "123456789", null);
runTest("11-digit number (too long)", "12345678901", null);
runTest("Only letters", "abcdefghij", null);
if (failures > 0) { process.exit(1); }
