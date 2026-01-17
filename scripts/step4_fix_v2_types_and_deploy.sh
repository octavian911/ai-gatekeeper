#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Patching V2 helper typings in: $FILE"

node <<'NODE'
const fs = require("fs");
const path = require("path");

const file = path.join(process.env.HOME, "ai-gatekeeper", "functions", "src", "index.ts");
let s = fs.readFileSync(file, "utf8");

// 1) Add explicit any types to V2 helpers (avoid TS7006)
s = s.replace(
  /function\s+agkReadAuthHeaderV2\s*\(\s*req\s*\)\s*\{/g,
  "function agkReadAuthHeaderV2(req: any) {"
);

s = s.replace(
  /function\s+agkExtractBearerV2\s*\(\s*req\s*\)\s*\{/g,
  "function agkExtractBearerV2(req: any) {"
);

s = s.replace(
  /async\s+function\s+requireAuthV2\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*\{/g,
  "async function requireAuthV2(req: any, res: any, next: any) {"
);

// 2) Replace String(e && e.message ? e.message : e) with TS-safe version
s = s.replace(
  /String\(\s*e\s*&&\s*e\.message\s*\?\s*e\.message\s*:\s*e\s*\)/g,
  "String((e as any)?.message || e)"
);

// Also handle any raw uses: e && e.message ? e.message : e
s = s.replace(
  /e\s*&&\s*e\.message\s*\?\s*e\.message\s*:\s*e/g,
  "((e as any)?.message || e)"
);

fs.writeFileSync(file, s, "utf8");
console.log("OK: patched V2 helper types + error stringification:", file);
NODE

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint -- --fix
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
