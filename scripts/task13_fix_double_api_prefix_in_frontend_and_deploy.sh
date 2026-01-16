#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

cd "$ROOT_DIR"

echo "== Task 13: Fix frontend double /api prefix for baselines endpoints =="

echo "== 1) Find offenders (\"/api/baselines\" in frontend source) =="
if command -v rg >/dev/null 2>&1; then
  rg -n --hidden --glob '!node_modules' '"/api/baselines|\'"'"'/api/baselines' "$FRONTEND_DIR" || true
else
  grep -RIn --exclude-dir node_modules --exclude-dir dist '/api/baselines' "$FRONTEND_DIR" || true
fi

echo "== 2) Patch: /api/baselines -> /baselines (only in source files) =="
# Only touch common source extensions
find "$FRONTEND_DIR" -type f \( \
  -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
\) -print0 | xargs -0 sed -i \
  -e 's|"\/api\/baselines|"/baselines|g' \
  -e "s|'/api/baselines|'/baselines|g"

echo "== 3) Sanity check (should now show /baselines, not /api/baselines) =="
if command -v rg >/dev/null 2>&1; then
  rg -n --hidden --glob '!node_modules' '"/api/baselines|\'"'"'/api/baselines' "$FRONTEND_DIR" && {
    echo "ERROR: still found /api/baselines in source. Aborting."
    exit 1
  } || true
fi

echo "== 4) Build frontend =="
cd "$FRONTEND_DIR"
if [ -f package-lock.json ]; then
  npm ci
  npm run build
else
  bun install
  bun run build
fi

echo "== 5) Deploy hosting ($HOSTING_SITE) =="
cd "$ROOT_DIR"
firebase deploy --only hosting:"$HOSTING_SITE" --project "$PROJECT_ID"

echo "== DONE ✅ =="
echo "Now retry upload. Network request URL must be:"
echo "  https://app.ai-gatekeeper.ca/api/baselines/upload-multi-fs   (single /api)"
