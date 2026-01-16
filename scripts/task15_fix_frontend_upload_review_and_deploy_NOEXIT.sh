#!/usr/bin/env bash
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

BACKUP="$ROOT_DIR/.backup_task15_frontend_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

log(){ echo "== $* =="; }
run(){ echo; echo ">> $*"; "$@"; rc=$?; echo "rc=$rc"; return 0; }

log "Task15: Fix frontend upload + review paths (NOEXIT)"
echo "ROOT: $ROOT_DIR"
echo "FRONTEND: $FRONTEND_DIR"
echo "BACKUP: $BACKUP"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"

# --- A) Patch UploadPanel ---
UPLOAD_PANEL="$FRONTEND_DIR/src/components/UploadPanel.tsx"
if [ -f "$UPLOAD_PANEL" ]; then
  log "Backup UploadPanel"
  cp -a "$UPLOAD_PANEL" "$BACKUP/UploadPanel.tsx" 2>/dev/null

  log "Patch UploadPanel (endpoint + meta blob + remove multipart header)"
  node - "$UPLOAD_PANEL" <<'NODE'
const fs = require("fs");
const f = process.argv[2]; // IMPORTANT: when using `node - file`, file is argv[2]
let t = fs.readFileSync(f, "utf8");

// 1) Force correct endpoint
t = t.replace(/(["'`])\/baselines\/upload-multi-fs\1/g, '$1/api/baselines/upload-multi-fs$1');
t = t.replace(/(["'`])\/api\/upload-multi-fs\1/g, '$1/api/baselines/upload-multi-fs$1');

// 2) Remove manual multipart content-type header (browser must set boundary)
t = t.replace(/["'`]Content-Type["'`]\s*:\s*["'`]multipart\/form-data["'`]\s*,?/g, "");

// 3) Ensure meta is sent as JSON blob (best effort):
// Replace any form.append("meta", <something>) with Blob JSON append
t = t.replace(
  /form\.append\(\s*["'`]meta["'`]\s*,\s*([^\)]+)\)\s*;?/g,
  'form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));'
);

fs.writeFileSync(f, t);
console.log("OK patched:", f);
NODE
else
  echo "WARN: UploadPanel not found at $UPLOAD_PANEL (skipping)"
fi

# --- B) Normalize any frontend/src calls: "/baselines/..." -> "/api/baselines/..." ---
log "Normalize /baselines/* -> /api/baselines/* across frontend/src (best-effort)"
if [ -d "$FRONTEND_DIR/src" ]; then
  run bash -lc '
cd "'"$FRONTEND_DIR"'" || exit 0
FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null)
[ -n "$FILES" ] || exit 0
for f in $FILES; do
  grep -q "/baselines/" "$f" || continue
  sed -i \
    -e "s#\"/baselines/#\"/api/baselines/#g" \
    -e "s#'\''/baselines/#'\''/api/baselines/#g" \
    -e "s#\`/baselines/#\`/api/baselines/#g" \
    "$f" 2>/dev/null || true
done
echo "OK: normalization pass done"
'
fi

# --- C) Build + Deploy hosting ---
log "Build frontend"
run npm --prefix "$FRONTEND_DIR" run build

log "Deploy hosting"
run firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID"

echo
echo "DONE (NOEXIT). Script always exits 0."
exit 0
