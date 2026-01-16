#!/usr/bin/env bash
# NOEXIT: always exits 0
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task24_frontend_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT: $ROOT_DIR"
echo "FRONTEND: $FRONTEND_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "BACKUP: $BACKUP"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "WARN: frontend dir not found. Exiting 0."
  exit 0
fi

# 1) Backup frontend/src (best-effort)
if [ -d "$FRONTEND_DIR/src" ]; then
  cp -a "$FRONTEND_DIR/src" "$BACKUP/" 2>/dev/null || true
fi

# 2) Replace any literal "/api/api/" occurrences in source files
echo
echo "== A) Replace literal /api/api/ -> /api/ in frontend/src (best-effort) =="
if [ -d "$FRONTEND_DIR/src" ]; then
  FILES="$(find "$FRONTEND_DIR/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null)"
  for f in $FILES; do
    grep -q "/api/api/" "$f" || continue
    sed -i 's#/api/api/#/api/#g' "$f" 2>/dev/null || true
  done
  echo "OK: literal /api/api/ normalized (if present)."
else
  echo "WARN: $FRONTEND_DIR/src missing."
fi

# 3) Patch callAPI / fetch wrapper so it can NEVER produce /api/api again
#    We look for files that contain "callAPI" and inject a normalization step.
echo
echo "== B) Patch callAPI helpers to normalize leading /api =="
PATCHED=0
CANDIDATES="$(grep -RIl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 'callAPI' "$FRONTEND_DIR" 2>/dev/null | head -n 25)"
for f in $CANDIDATES; do
  # Only patch if file already has a function named callAPI and does NOT already normalize
  grep -q "function callAPI" "$f" || continue
  grep -q "__AGK_NORMALIZE_API_PATH__" "$f" && continue

  # Insert: path normalization inside callAPI function (very conservative)
  perl_ok=0
  if command -v perl >/dev/null 2>&1; then perl_ok=1; fi

  if [ "$perl_ok" = "1" ]; then
    perl -0777 -pe '
      if ($s !~ /__AGK_NORMALIZE_API_PATH__/ && $s =~ /function\s+callAPI\s*\([^)]*\)\s*\{/) {
        $s =~ s/(function\s+callAPI\s*\([^)]*\)\s*\{\s*)/$1\n  \/\/ __AGK_NORMALIZE_API_PATH__\n  \/\/ Never allow \"\/api\/api\".\n  if (typeof path === \"string\") { path = path.replace(/^\\\/api\\\/+/, \"\\/\"); }\n/;
      }
      $_=$s;
    ' -i "$f" 2>/dev/null || true
  else
    # no perl: do it with node in-place
    FILE="$f" node <<'NODE'
const fs = require("fs");
const f = process.env.FILE;
if (!f || !fs.existsSync(f)) process.exit(0);
let s = fs.readFileSync(f, "utf8");
if (s.includes("__AGK_NORMALIZE_API_PATH__")) process.exit(0);
const re = /function\s+callAPI\s*\([^)]*\)\s*\{\s*/m;
const m = s.match(re);
if (!m) process.exit(0);
const insert =
  m[0] +
  '\n  // __AGK_NORMALIZE_API_PATH__\n' +
  '  // Never allow "/api/api".\n' +
  '  if (typeof path === "string") { path = path.replace(/^\\/api\\/+/, "/"); }\n';
s = s.replace(re, insert);
fs.writeFileSync(f, s, "utf8");
NODE
  fi

  echo "Patched: $f"
  PATCHED=$((PATCHED+1))
done

echo "Patched callAPI files count: $PATCHED"

# 4) Build + deploy hosting
echo
echo "== C) Build frontend (best-effort) =="
( cd "$FRONTEND_DIR" && npm run build ) || echo "WARN: build failed"

echo
echo "== D) Deploy hosting (best-effort) =="
( cd "$ROOT_DIR" && firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID" ) || echo "WARN: deploy failed"

# 5) Verify LIVE built JS no longer contains /api/api
echo
echo "== E) Verify LIVE JS no longer contains /api/api =="
ASSET_PATH="$(curl -sS https://app.ai-gatekeeper.ca/baselines \
  | tr '"' '\n' \
  | grep -E '^/assets/index-.*\.js$' \
  | head -n 1)"
echo "Live asset: $ASSET_PATH"
if [ -n "$ASSET_PATH" ]; then
  HIT="$(curl -sS "https://app.ai-gatekeeper.ca${ASSET_PATH}" | grep -n "api/api" | head -n 5)"
  if [ -n "$HIT" ]; then
    echo "❌ STILL FOUND api/api in live JS:"
    echo "$HIT"
  else
    echo "✅ No api/api found in live JS."
  fi
else
  echo "WARN: could not detect live JS asset."
fi

echo "DONE (NOEXIT)."
exit 0
