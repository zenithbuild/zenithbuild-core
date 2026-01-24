const fs = require('fs');
const path = require('path');

const filePath = '/Users/judahsullivan/Personal/zenith/zenith-site/src/dist/verify-phase-2/index.html';
const content = fs.readFileSync(filePath, 'utf8');

// Find the script start
const startMarker = 'window.__ZENITH_PLUGIN_DATA__ = ';
const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
    console.error('Could not find window.__ZENITH_PLUGIN_DATA__ assignment');
    process.exit(1);
}

// The script tag ends with ;</script>
// But wait, the generated code is `${envelopeJson};</script>`
// So we look for the next `;` followed by `</script>` or just the end of the script block.

// Let's assume it ends at the last `}` before `;</script>`
// Actually, `JSON.stringify` creates a single value.
// It might be safest to extract everything until `;</script>`

const remaining = content.slice(startIndex + startMarker.length);
const scriptEndIndex = remaining.indexOf(';</script>');

if (scriptEndIndex === -1) {
    console.error('Could not find end of script block');
    console.log('Context around expected end:', remaining.slice(-100));
    process.exit(1);
}

const jsonString = remaining.slice(0, scriptEndIndex);

console.log('Extracted JSON length:', jsonString.length);

// Check for U+2028 and U+2029 (Line Separator and Paragraph Separator)
// These are valid in JSON but are treated as newlines in JS, checking syntax error.
const hasLS = jsonString.includes('\u2028');
const hasPS = jsonString.includes('\u2029');

if (hasLS || hasPS) {
    console.error('JSON contains Line Separator (U+2028) or Paragraph Separator (U+2029)!');
    console.error('This causes SyntaxError in JavaScript strings/sources.');
} else {
    console.log('No U+2028 or U+2029 found.');
}

// Check for unescaped </ sequence which breaks HTML script tags
// The build script should have replaced </ with <\/
// in the file, this looks like <\/ (backslash /)
// We want to ensure there are no </ (no backslash)
const brokenTagIndex = jsonString.indexOf('</');
if (brokenTagIndex !== -1) {
    console.error('Found unescaped </ sequence in JSON! This breaks the script tag.');
    console.log('Context:', jsonString.slice(brokenTagIndex - 20, brokenTagIndex + 20));
} else {
    console.log('No unescaped </ sequences found (HTML safety check passed).');
}

try {
    JSON.parse(jsonString);
    console.log('JSON.parse successful.');

    // Also try to execute it as JS to be sure
    const vm = require('vm');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    const code = `window.__ZENITH_PLUGIN_DATA__ = ${jsonString};`;
    vm.runInContext(code, sandbox);
    console.log('Reference VM execution successful. window.__ZENITH_PLUGIN_DATA__ is set.');
} catch (e) {
    console.error('JSON.parse or VM execution failed:', e.message);
}

