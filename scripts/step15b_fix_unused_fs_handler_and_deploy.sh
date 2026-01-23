#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step15b: Fix TS6133 by ensuring __fsListHandler is USED by routes"
echo "    Target: $FILE"

# Backup
ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step15b_$ts"
echo "==> Backup: $FILE.bak_step15b_$ts"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("const __fsListHandler")) {
  console.error("ERROR: Could not find 'const __fsListHandler' in index.ts. Nothing to rewire.");
  process.exit(1);
}

const before = s;

// Rewire /api/baselines/fs route to __fsListHandler
s = s.replace(
  /app\.get\(\s*"\/api\/baselines\/fs"\s*,\s*requireAuthV2\s*,\s*[A-Za-z0-9_]+\s*\)\s*;/g,
  'app.get("/api/baselines/fs", requireAuthV2, __fsListHandler);'
);

// Rewire /baselines/fs route to __fsListHandler
s = s.replace(
  /app\.get\(\s*"\/baselines\/fs"\s*,\s*requireAuthV2\s*,\s*[A-Za-z0-9_]+\s*\)\s*;/g,
  'app.get("/baselines/fs", requireAuthV2, __fsListHandler);'
);

// If those routes were missing entirely (rare), add them right after handler block end marker if present.
if (!s.includes('app.get("/api/baselines/fs", requireAuthV2, __fsListHandler);')) {
  console.error("ERROR: After replacement, /api/baselines/fs route not found. Aborting to avoid breaking file.");
  process.exit(1);
}
if (!s.includes('app.get("/baselines/fs", requireAuthV2, __fsListHandler);')) {
  console.error("ERROR: After replacement, /baselines/fs route not found. Aborting to avoid breaking file.");
  process.exit(1);
}

if (s === before) {
  console.log("NOTE: No route text changed (maybe already correct).");
} else {
  console.log("OK: Rewired both fs routes to __fsListHandler.");
}

fs.writeFileSync(file, s, "utf8");
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

echo "✅ Step15b DONE"
