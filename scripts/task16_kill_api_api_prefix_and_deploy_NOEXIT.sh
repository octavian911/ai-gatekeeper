#!/usr/bin/env bash
# NOEXIT: never returns exit code 1. Logs failures but exits 0.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

BACKUP="$ROOT_DIR/.backup_task16_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

log(){ echo; echo "== $* =="; }
run(){ echo ">> $*"; "$@"; rc=$?; echo "rc=$rc"; return 0; }

log "Task16: eliminate /api/api double-prefix (NOEXIT)"
echo "ROOT: $ROOT_DIR"
echo "FRONTEND: $FRONTEND_DIR"
echo "BACKUP: $BACKUP"
echo "PROJECT: $PROJECT_ID"

# --- 0) Safety checks ---
if [ ! -d "$FRONTEND_DIR" ]; then
  echo "WARN: frontend dir not found: $FRONTEND_DIR"
  exit 0
fi

# --- 1) Backup key files ---
UPLOAD_PANEL="$FRONTEND_DIR/src/components/UploadPanel.tsx"
CLIENT_TS="$FRONTEND_DIR/client.ts"

[ -f "$UPLOAD_PANEL" ] && cp -a "$UPLOAD_PANEL" "$BACKUP/UploadPanel.tsx" 2>/dev/null
[ -f "$CLIENT_TS" ] && cp -a "$CLIENT_TS" "$BACKUP/client.ts" 2>/dev/null

# --- 2) Revert any '/api/baselines/*' inside frontend/src back to '/baselines/*'
# BUT do NOT touch UploadPanel (it should use /api/baselines for raw fetch).
log "Revert '/api/baselines/*' -> '/baselines/*' across frontend/src (except UploadPanel)"
run bash -lc '
cd "'"$FRONTEND_DIR"'" || exit 0
[ -d src ] || exit 0
FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | grep -v "/UploadPanel.tsx$" || true)
[ -n "$FILES" ] || exit 0
for f in $FILES; do
  grep -q "/api/baselines/" "$f" || continue
  sed -i \
    -e "s#\"/api/baselines/#\"/baselines/#g" \
    -e "s#'\''/api/baselines/#'\''/baselines/#g" \
    -e "s#\`/api/baselines/#\`/baselines/#g" \
    "$f" 2>/dev/null || true
done
echo "OK: reverted /api/baselines -> /baselines in frontend/src (excluding UploadPanel)"
'

# --- 3) Force UploadPanel to use raw fetch endpoint '/api/baselines/upload-multi-fs'
log "Force UploadPanel endpoint to /api/baselines/upload-multi-fs (raw fetch)"
if [ -f "$UPLOAD_PANEL" ]; then
  run node - "$UPLOAD_PANEL" <<'NODE'
const fs = require("fs");
const f = process.argv[2]; // node - file  => file is argv[2]
let t = fs.readFileSync(f, "utf8");

// Force correct upload endpoint for raw fetch
t = t.replace(/(["'`])\/api\/api\/baselines\/upload-multi-fs\1/g, '$1/api/baselines/upload-multi-fs$1');
t = t.replace(/(["'`])\/api\/upload-multi-fs\1/g, '$1/api/baselines/upload-multi-fs$1');
t = t.replace(/(["'`])\/baselines\/upload-multi-fs\1/g, '$1/api/baselines/upload-multi-fs$1');

fs.writeFileSync(f, t);
console.log("OK patched:", f);
NODE
else
  echo "WARN: UploadPanel not found at $UPLOAD_PANEL (skipping)"
fi

# --- 4) Build frontend ---
log "Build frontend"
run npm --prefix "$FRONTEND_DIR" run build

# --- 5) Deploy ALL hosting targets defined in firebase.json ---
# This avoids deploying to the wrong hosting site.
log "Deploy hosting (ALL sites in firebase.json)"
run firebase deploy --only hosting --project "$PROJECT_ID"

# --- 6) Live verification: check deployed JS for '/api/baselines' (the thing that causes /api/api at runtime)
log "Live verify: does live JS contain '/api/baselines' ?"
ASSET_PATH="$(curl -sS https://app.ai-gatekeeper.ca/baselines \
  | tr '"' '\n' \
  | grep -E '^/assets/index-.*\.js$' \
  | head -n 1)"
echo "Live asset: $ASSET_PATH"
if [ -n "$ASSET_PATH" ]; then
  echo "Count of '/api/baselines' in live JS:"
  curl -sS "https://app.ai-gatekeeper.ca${ASSET_PATH}" | grep -o "/api/baselines" | wc -l | tr -d " "
  echo "Count of '/api/api/' in live JS:"
  curl -sS "https://app.ai-gatekeeper.ca${ASSET_PATH}" | grep -o "/api/api/" | wc -l | tr -d " "
else
  echo "WARN: could not detect live asset path from /baselines HTML"
fi

echo
echo "DONE (NOEXIT). If Network still shows /api/api, it means your API wrapper is prefixing /api AND some callsites still include /api."
exit 0
