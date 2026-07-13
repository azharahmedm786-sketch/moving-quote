const fs = require('fs');

global.window = {
  location: { search: "" },
  addEventListener: () => {}
};
global.document = {
  getElementById: (id) => ({ addEventListener: () => {}, style: {}, innerHTML: "" }),
  querySelector: () => ({ addEventListener: () => {}, style: {} }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.navigator = { userAgent: "" };

const code = fs.readFileSync('script.js', 'utf8');
try { eval(code); } catch (e) { console.error("Error evaluating script.js:", e); }

function runTests() {
  let passed = 0; let failed = 0;

  function test(name, input, expected) {
    try {
      const result = escapeHTML(input);
      if (result === expected) { console.log(`✅ ${name} passed.`); passed++; }
      else { console.error(`❌ ${name} failed. Expected "${expected}", got "${result}"`); failed++; }
    } catch (e) { console.error(`❌ ${name} threw an error: ${e}`); failed++; }
  }

  console.log("--- Running escapeHTML Tests ---");
  test("Empty string", "", "");
  test("Null input", null, "");
  test("Undefined input", undefined, "");
  test("Number 0", 0, "0");
  test("No special characters", "Hello World", "Hello World");
  test("Ampersand", "Tom & Jerry", "Tom &amp; Jerry");
  test("Less than and Greater than", "<script>alert('XSS')</script>", "&lt;script&gt;alert(&#039;XSS&#039;)&lt;/script&gt;");
  test("Double quotes", 'He said "Hello"', 'He said &quot;Hello&quot;');
  test("Single quotes", "It's a test", "It&#039;s a test");
  test("Mixed characters", '<div class="test">Bob & Alice\'s "House"</div>', "&lt;div class=&quot;test&quot;&gt;Bob &amp; Alice&#039;s &quot;House&quot;&lt;/div&gt;");
  test("Multiple of same character", "<<<>>>", "&lt;&lt;&lt;&gt;&gt;&gt;");
  test("Non-string input (numbers)", 12345, "12345");

  console.log(`\nEscapeHTML Tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
