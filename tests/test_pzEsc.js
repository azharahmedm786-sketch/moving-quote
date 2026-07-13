const fs = require('fs');
const { JSDOM } = require('jsdom');

// Setup minimal JSDOM environment required by pzEsc
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.URLSearchParams = dom.window.URLSearchParams;

// Read and eval the partner.js script to get pzEsc function
const code = fs.readFileSync('partner.js', 'utf8');
eval(code);

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, input, expected) {
    try {
      const result = pzEsc(input);
      if (result === expected) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.error(`❌ ${name} failed. Expected: '${expected}', Got: '${result}'`);
        failed++;
      }
    } catch (e) {
      console.error(`❌ ${name} threw an error: ${e}`);
      failed++;
    }
  }

  console.log('--- Running pzEsc tests ---');

  // Normal strings
  test('Normal string', 'Hello World', 'Hello World');

  // HTML escaping
  test('Escapes HTML tags', '<div>Test</div>', '&lt;div&gt;Test&lt;/div&gt;');
  test('Escapes scripts', '<script>alert("XSS")</script>', '&lt;script&gt;alert("XSS")&lt;/script&gt;');
  test('Escapes quotes', '"Double" and \'Single\'', '"Double" and \'Single\''); // textContent escapes angle brackets and ampersands

  // Null/Undefined/Empty
  test('Handles null', null, '');
  test('Handles undefined', undefined, '');
  test('Handles empty string', '', '');

  // Numbers and other types
  test('Handles numbers', 12345, '12345');
  test('Handles booleans', true, 'true');
  test('Handles object', { key: 'value' }, '[object Object]');

  console.log(`--- Test Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
