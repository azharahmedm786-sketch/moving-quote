const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const code = fs.readFileSync('script.js', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();

// We need to mock a few properties to prevent initialization errors in script.js when evaluated
const mockScript = `
  window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  window.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  window.google = { maps: { places: { Autocomplete: function() {} } } };
`;

// Use JSDOM to load the script globally
const dom = new JSDOM(`<!DOCTYPE html><html><body><script>${mockScript}</script><script>${code}</script></body></html>`, {
  runScripts: "dangerously",
  url: "http://localhost",
  virtualConsole
});

// Since JSDOM eval sets top-level functions on the window object
const sanitizeHTML = dom.window.sanitizeHTML;

if (typeof sanitizeHTML !== 'function') {
  console.error("❌ sanitizeHTML function not found on the window object.");
  process.exit(1);
}

let passed = true;

function runTest(name, input, expected) {
  const result = sanitizeHTML(input);
  if (result === expected) {
    console.log(`✅ ${name} passed.`);
  } else {
    console.error(`❌ ${name} failed.`);
    console.error(`   Input:    ${input}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Got:      ${result}`);
    passed = false;
  }
}

console.log("Running sanitizeHTML tests...");

runTest("Plain text", "Hello World", "Hello World");
runTest("Script tag", "<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;");
runTest("HTML tags", '<b onmouseover="alert(1)">bold</b>', '&lt;b onmouseover="alert(1)"&gt;bold&lt;/b&gt;');
runTest("Ampersand", "A & B", "A &amp; B");
runTest("Empty string", "", "");
runTest("Null input", null, "");
runTest("Undefined input", undefined, "");
runTest("Quotes", 'He said "hello" and \'hi\'', 'He said "hello" and \'hi\'');
runTest("Malicious attributes", '<a href="javascript:alert(1)">link</a>', '&lt;a href="javascript:alert(1)"&gt;link&lt;/a&gt;');
runTest("Multiple tags", '<div><p>text</p></div>', '&lt;div&gt;&lt;p&gt;text&lt;/p&gt;&lt;/div&gt;');

if (!passed) {
  process.exit(1);
} else {
  console.log("All security tests passed!");
}
