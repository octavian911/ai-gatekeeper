#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step19c: Fix multiple 'export const api' duplicates, keep LAST, then deploy"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step19c_$ts"
echo "==> Backup: $FILE.bak_step19c_$ts"

node <<'NODE'
const fs = require("fs");

const filePath = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
const lines = fs.readFileSync(filePath, "utf8").split("\n");

const apiIdx = [];
for (let i = 0; i < lines.length; i++) {
  if (/^\s*export\s+const\s+api\b/.test(lines[i])) apiIdx.push(i);
}

if (apiIdx.length <= 1) {
  console.log("OK: api export count =", apiIdx.length, "(no change needed)");
  process.exit(0);
}

const keep = apiIdx[apiIdx.length - 1]; // keep LAST
for (const idx of apiIdx) {
  if (idx !== keep) {
    lines[idx] = "// DUPLICATE_REMOVED_BY_STEP19C: " + lines[idx];
  }
}

fs.writeFileSync(filePath, lines.join("\n"), "utf8");
console.log("OK: api export duplicates fixed. Found =", apiIdx.length, "kept line =", keep + 1);
NODE

echo "==> Sanity: show remaining api export lines"
grep -nE '^\s*export\s+const\s+api\b' "$FILE" || true
echo "==> Sanity: show commented duplicates"
grep -n 'DUPLICATE_REMOVED_BY_STEP19C' "$FILE" || true

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step19c DONE"
