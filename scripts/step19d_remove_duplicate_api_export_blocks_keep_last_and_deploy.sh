#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step19d: Remove duplicate api export BLOCKS (keep last), then lint/build/deploy"
echo "    Target: $FILE"

# Restore the backup created by Step19c (so we start from a consistent point)
BACKUP="$(ls -1t "$FILE".bak_step19c_* 2>/dev/null | head -n 1 || true)"
if [ -z "$BACKUP" ]; then
  echo "ERROR: could not find Step19c backup (index.ts.bak_step19c_*) to restore from." >&2
  exit 1
fi

echo "==> Restoring from: $BACKUP"
cp -f "$BACKUP" "$FILE"

node <<'NODE'
const fs = require("fs");

const filePath = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let lines = fs.readFileSync(filePath, "utf8").split("\n");

// Find every "export const api = functions.onRequest(" line
const starts = [];
for (let i = 0; i < lines.length; i++) {
  if (/^\s*export\s+const\s+api\s*=\s*functions\.onRequest\s*\(/.test(lines[i])) {
    starts.push(i);
  }
}

if (starts.length <= 1) {
  console.log("OK: api export blocks =", starts.length, "(nothing to remove)");
  process.exit(0);
}

const keepStart = starts[starts.length - 1]; // keep LAST
console.log("Found api export blocks:", starts.map(i => i + 1).join(", "), "keeping:", keepStart + 1);

// For each start before the last, delete the whole block until a line that looks like the closing ');'
const toDeleteRanges = [];

for (const s of starts.slice(0, -1)) {
  let e = -1;
  // scan forward up to 5000 lines max (very safe) to find end of onRequest block
  for (let j = s; j < Math.min(lines.length, s + 5000); j++) {
    // typical closers: ");" or "); " or ");\r"
    if (/^\s*\)\s*;\s*$/.test(lines[j]) || /^\s*\)\s*;\s*\/\/.*$/.test(lines[j]) || /^\s*\)\s*;\s*$/m.test(lines[j])) {
      e = j;
      break;
    }
    // also common: "});" or "});;" etc — but we only want end of onRequest, which is usually ");"
    if (/^\s*\)\s*;\s*$/.test(lines[j])) {
      e = j;
      break;
    }
    // some codebases close onRequest with ");" exactly, but allow "));" patterns — keep simple
    if (/\)\s*;\s*$/.test(lines[j]) && lines[j].includes(");")) {
      // only accept if line ends with );
      if (lines[j].trim().endsWith(");")) { e = j; break; }
    }
  }

  if (e === -1) {
    console.error("ERROR: Could not find end ');' for api export block starting at line", s + 1);
    process.exit(2);
  }

  toDeleteRanges.push([s, e]);
}

// Delete ranges from bottom to top so indices don't shift
toDeleteRanges.sort((a,b)=>b[0]-a[0]);
for (const [s,e] of toDeleteRanges) {
  const removed = e - s + 1;
  lines.splice(s, removed);
  console.log("Removed api export block:", (s+1) + ".." + (e+1), "lines removed:", removed);
}

fs.writeFileSync(filePath, lines.join("\n"), "utf8");
console.log("OK: duplicate api export blocks removed; last block kept.");
NODE

echo "==> Sanity: api export occurrences after cleanup"
grep -nE '^\s*export\s+const\s+api\s*=\s*functions\.onRequest' "$FILE" || true

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step19d DONE"
