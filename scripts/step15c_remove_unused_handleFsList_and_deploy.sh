#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step15c (PERMANENT): Remove unused handleFsList to fix TS6133"
echo "    Target: $FILE"

# Backup
ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step15c_$ts"
echo "==> Backup: $FILE.bak_step15c_$ts"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

const pat = /(^|\n)([ \t]*)const[ \t]+handleFsList[ \t]*=[ \t]*async[ \t]*\([^\)]*\)[ \t]*=>[ \t]*\{/m;
const m = s.match(pat);

if (!m) {
  console.log("OK: No handleFsList block found (nothing to remove).");
  process.exit(0);
}

const startIdx = s.indexOf(m[0]) + (m[1] ? m[1].length : 0); // start at newline or beginning
const braceStart = s.indexOf("{", startIdx);
if (braceStart < 0) {
  console.error("ERROR: Found handleFsList start but no opening '{'. Aborting.");
  process.exit(1);
}

// Walk forward counting braces to find the end of the function block
let i = braceStart;
let depth = 0;

while (i < s.length) {
  const ch = s[i];

  if (ch === "{") depth++;
  else if (ch === "}") {
    depth--;
    if (depth === 0) break;
  }
  i++;
}

if (depth !== 0) {
  console.error("ERROR: Could not find matching closing '}' for handleFsList. Aborting.");
  process.exit(1);
}

// Now move forward to consume trailing `);` or `;` after the function block
let endIdx = i + 1;
while (endIdx < s.length && /\s/.test(s[endIdx])) endIdx++;
if (s[endIdx] === ";") endIdx++;
else {
  // sometimes it's `});` or `};`
  if (s.slice(endIdx, endIdx + 2) === ");") endIdx += 2;
  else if (s.slice(endIdx, endIdx + 2) === "};") endIdx += 2;
  else {
    // consume up to next semicolon as a fallback
    const semi = s.indexOf(";", endIdx);
    if (semi > -1) endIdx = semi + 1;
  }
}

const removed = s.slice(startIdx, endIdx);
s = s.slice(0, startIdx) + "\n" + s.slice(endIdx);

// Reduce excessive blank lines in the area (eslint will also fix later)
s = s.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("OK: Removed handleFsList block (" + removed.length + " chars).");
NODE

echo "==> ESLint auto-fix index.ts"
cd "$ROOT/functions" || exit 1
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step15c DONE"
