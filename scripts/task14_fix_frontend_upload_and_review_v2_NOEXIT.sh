#!/usr/bin/env bash
# NOEXIT: never returns exit code 1. Logs failures but always exits 0.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/.backup_task14_frontend_$TS"
mkdir -p "$BACKUP_DIR"

STATUS=0
run() {
  echo
  echo ">> $*"
  "$@"
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "!! WARN rc=$rc: $*"
    STATUS=1
  fi
  return 0
}

backup_file() {
  f="$1"
  [ -f "$f" ] || return 0
  mkdir -p "$BACKUP_DIR/$(dirname "${f#$ROOT_DIR/}")" 2>/dev/null
  cp -a "$f" "$BACKUP_DIR/${f#$ROOT_DIR/}" 2>/dev/null
  return 0
}

echo "== Task14 v2: Fix frontend upload + review endpoints, deploy hosting (NOEXIT) =="
echo "ROOT: $ROOT_DIR"
echo "FRONTEND: $FRONTEND_DIR"
echo "BACKUP: $BACKUP_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"

# ---------- 1) Patch UploadPanel endpoint + safe FormData header rules ----------
UPLOAD_PANEL=""
for c in \
  "$FRONTEND_DIR/src/components/UploadPanel.tsx" \
  "$FRONTEND_DIR/src/components/UploadPanel.ts" \
  "$FRONTEND_DIR/components/UploadPanel.tsx" \
  "$FRONTEND_DIR/components/UploadPanel.ts"
do
  if [ -f "$c" ]; then UPLOAD_PANEL="$c"; break; fi
done

if [ -n "$UPLOAD_PANEL" ]; then
  echo
  echo "== Patch UploadPanel: $UPLOAD_PANEL =="
  backup_file "$UPLOAD_PANEL"

  # Use node-heredoc to avoid bash quoting issues
  run node - "$UPLOAD_PANEL" <<'NODE'
const fs = require("fs");
const f = process.argv[1];
let t = fs.readFileSync(f, "utf8");

// 1) Ensure upload goes through /api
t = t.replace(/(["'`])\/baselines\/upload-multi-fs\1/g, '$1/api/baselines/upload-multi-fs$1');
t = t.replace(/(["'`])\/api\/upload-multi-fs\1/g, '$1/api/baselines/upload-multi-fs$1');

// 2) Never manually set multipart content-type for FormData (browser sets boundary)
t = t.replace(/["'`]Content-Type["'`]\s*:\s*["'`]multipart\/form-data["'`]\s*,?/g, "");

// 3) If meta append exists, make it JSON-Blob (safe best-effort)
const metaBlobLine = 'form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));';
t = t.replace(/form\.append\(\s*["'`]meta["'`]\s*,\s*([^\)]+)\)\s*;?/g, metaBlobLine);

fs.writeFileSync(f, t);
console.log("OK: UploadPanel patched (/api endpoint, no manual multipart header, meta blob best-effort)");
NODE

else
  echo
  echo "WARN: UploadPanel not found in expected locations. Skipping UploadPanel patch."
  STATUS=1
fi

# ---------- 2) Patch any remaining frontend src fetches or calls that hit /baselines/* without /api ----------
echo
echo "== Patch any /baselines/* in frontend/src -> /api/baselines/* (best-effort) =="
run bash -lc '
cd "'"$FRONTEND_DIR"'" || exit 0
[ -d src ] || exit 0
FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null)
[ -n "$FILES" ] || exit 0
for f in $FILES; do
  grep -q "/baselines/" "$f" || continue
  sed -i "s#\"/baselines/#\"/api/baselines/#g; s#'\''/baselines/#'\''/api/baselines/#g" "$f" || true
done
echo "OK: normalized /baselines/* -> /api/baselines/* in frontend/src"
'

# ---------- 3) Build + deploy hosting ----------
echo
echo "== Build frontend =="
run npm --prefix "$FRONTEND_DIR" run build

echo
echo "== Deploy hosting =="
run firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID"

echo
echo "== DONE (NOEXIT) =="
if [ $STATUS -ne 0 ]; then
  echo "Some steps failed above, but script exits 0. Check output."
fi
exit 0
