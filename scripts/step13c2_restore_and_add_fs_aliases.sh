#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step13c2: Restore last Step13c backup + add /baselines aliases safely"
echo "    Target: $FILE"

# 1) Restore the most recent Step13c backup
BACKUP="$(ls -t "$FILE".bak_step13c_* 2>/dev/null | head -n 1 || true)"
if [[ -z "${BACKUP}" ]]; then
  echo "ERROR: No backup found matching: $FILE.bak_step13c_*"
  echo "Run: ls -la $FILE.bak_*"
  exit 1
fi

echo "==> Restoring from: $BACKUP"
cp -f "$BACKUP" "$FILE"

# 2) Patch in a minimal way: duplicate the existing /api routes to /baselines/*
FILE="$FILE" node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
if (!file) { console.error("Missing FILE env"); process.exit(2); }

let src = fs.readFileSync(file, "utf8");

// If aliases already exist, do nothing.
if (src.includes('app.get("/baselines/fs"') && src.includes('app.get("/baselines/fs_download"')) {
  console.log("OK: /baselines/fs and /baselines/fs_download already exist. No change.");
  process.exit(0);
}

// Grab the existing /api/baselines/fs handler block
const reFs = /(app\.get\(\s*["']\/api\/baselines\/fs["']\s*,\s*requireAuthV2\s*,[\s\S]*?\n\}\);\n)/s;
const mFs = src.match(reFs);
if (!mFs) { console.error('ERROR: Could not find /api/baselines/fs route block'); process.exit(2); }

let fsBlock = mFs[1];

// Ensure downloadUrl uses the non-/api path so it works in both routing modes
fsBlock = fsBlock.replace(
  /downloadUrl:\s*[`'"]\/api\/baselines\/fs_download\?name=\$\{encodeURIComponent$begin:math:text$f\\\.name$end:math:text$\}[`'"]/g,
  'downloadUrl: `/baselines/fs_download?name=${encodeURIComponent(f.name)}`'
);
fsBlock = fsBlock.replace(
  /downloadUrl:\s*["']\/api\/baselines\/fs_download\?name=\$\{encodeURIComponent\(f\.name\)\}["']/g,
  'downloadUrl: `/baselines/fs_download?name=${encodeURIComponent(f.name)}`'
);
fsBlock = fsBlock.replace(
  /downloadUrl:\s*["']\/api\/baselines\/fs_download\?name=\$\{encodeURIComponent\(f\.name\)\}["']/g,
  'downloadUrl: `/baselines/fs_download?name=${encodeURIComponent(f.name)}`'
);
fsBlock = fsBlock.replace(
  /downloadUrl:\s*["']\/api\/baselines\/fs_download\?name=\$\{encodeURIComponent\(f\.name\)\}["']/g,
  'downloadUrl: `/baselines/fs_download?name=${encodeURIComponent(f.name)}`'
);

// Replace the original block with the updated block (same path) + an alias copy (path swapped)
const fsAlias = fsBlock.replace('"/api/baselines/fs"', '"/baselines/fs"');

src = src.replace(reFs, fsBlock + "\n" + fsAlias + "\n");

// Grab the existing /api/baselines/fs_download handler block
const reDl = /(app\.get\(\s*["']\/api\/baselines\/fs_download["']\s*,\s*requireAuthV2\s*,[\s\S]*?\n\}\);\n)/s;
const mDl = src.match(reDl);
if (!mDl) { console.error('ERROR: Could not find /api/baselines/fs_download route block'); process.exit(2); }

const dlBlock = mDl[1];
const dlAlias = dlBlock.replace('"/api/baselines/fs_download"', '"/baselines/fs_download"');

src = src.replace(reDl, dlBlock + "\n" + dlAlias + "\n");

fs.writeFileSync(file, src, "utf8");
console.log("OK: Added /baselines/fs + /baselines/fs_download aliases, and normalized downloadUrl to /baselines/fs_download.");
NODE

# 3) Lint + build + deploy
echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo
echo "==> DONE. Quick grep to confirm routes exist:"
grep -nE 'app\.get\("(/api)?/baselines/fs(_download)?"' "$FILE" || true

echo
echo "==> Test (paste a fresh Firebase ID token, then Enter):"
unset JWT 2>/dev/null || true
read -r JWT
export JWT

BASE="https://api-cbkg2trx7q-uc.a.run.app"

echo
echo "==> /api/baselines/fs_debug"
curl -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs_debug?t=$(date +%s)" | head -n 40

echo
echo "==> /api/baselines/fs"
curl -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 80

echo
echo "==> /baselines/fs"
curl -sS -i -H "Authorization: Bearer $JWT" "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 80
