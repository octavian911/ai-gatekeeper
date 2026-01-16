#!/usr/bin/env bash
# NOEXIT: always exits 0, even if something fails.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task25_frontend_$(ts)"
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

# Backup (best-effort)
if [ -d "$FRONTEND_DIR/src" ]; then
  cp -a "$FRONTEND_DIR/src" "$BACKUP/" 2>/dev/null || true
fi
for extra in "$FRONTEND_DIR/client.ts" "$FRONTEND_DIR/src/client.ts" "$FRONTEND_DIR/src/lib/client.ts" "$FRONTEND_DIR/src/api.ts" "$FRONTEND_DIR/src/lib/api.ts"; do
  [ -f "$extra" ] && cp -a "$extra" "$BACKUP/" 2>/dev/null || true
done

echo
echo "== A) Hard replace any '/api/api' -> '/api' everywhere in frontend (source only) =="
FILES="$(find "$FRONTEND_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null)"
for f in $FILES; do
  grep -q "/api/api" "$f" || continue
  sed -i 's#/api/api#/api#g' "$f" 2>/dev/null || true
done
echo "OK: replaced /api/api -> /api where found."

echo
echo "== B) Find the REAL API helper file (getAuthHeaders/callAPI) =="
TARGETS="$(grep -RIl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' -E 'getAuthHeaders|function callAPI|const callAPI|callAPI\s*=' "$FRONTEND_DIR/src" 2>/dev/null | head -n 20)"
echo "$TARGETS" | sed 's/^/CANDIDATE: /'

# Choose best target: prefer file that contains getAuthHeaders, else first candidate
BEST=""
for f in $TARGETS; do
  grep -q "getAuthHeaders" "$f" && BEST="$f" && break
done
if [ -z "$BEST" ]; then
  BEST="$(echo "$TARGETS" | head -n 1)"
fi
echo "BEST: ${BEST:-NOT FOUND}"

echo
echo "== C) Patch getAuthHeaders (wait for auth + always return Bearer when logged-in) =="
if [ -n "$BEST" ] && [ -f "$BEST" ]; then
  # Use node in-place patch (no perl)
  node - "$BEST" <<'NODE' || true
const fs = require("fs");
const file = process.argv[2];
if (!file || !fs.existsSync(file)) process.exit(0);
let s = fs.readFileSync(file, "utf8");
if (s.includes("__AGK_AUTH_HEADERS_V1__")) {
  console.log("Already patched auth headers:", file);
  process.exit(0);
}

// Patch strategy:
// - If there's an existing async function getAuthHeaders() { ... } -> replace its body safely.
// - Else, inject a new helper and a tiny wrapper inside callAPI if present.
function replaceGetAuthHeaders(src){
  const re = /async function getAuthHeaders\s*\(\s*\)\s*\{[\s\S]*?\n\}/m;
  if (!re.test(src)) return null;

  const body =
`async function getAuthHeaders() {
  // __AGK_AUTH_HEADERS_V1__
  // Wait briefly for Firebase auth to be ready, then attach Bearer token.
  try {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    const deadline = Date.now() + 6000; // up to 6s
    while (!auth.currentUser && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (!auth.currentUser) return {};
    const tok = await auth.currentUser.getIdToken();
    return { Authorization: "Bearer " + tok };
  } catch (e) {
    return {};
  }
}\n`;
  return src.replace(re, body.trimEnd());
}

let out = replaceGetAuthHeaders(s);
if (out === null) {
  // No getAuthHeaders function found: inject helper near top
  const inject =
`\n// __AGK_AUTH_HEADERS_V1__
async function __agkGetAuthHeaders() {
  try {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    const deadline = Date.now() + 6000;
    while (!auth.currentUser && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (!auth.currentUser) return {};
    const tok = await auth.currentUser.getIdToken();
    return { Authorization: "Bearer " + tok };
  } catch (e) {
    return {};
  }
}\n`;

  // If callAPI exists, try to add header merge
  const callAPIRe = /function\s+callAPI\s*\(([^)]*)\)\s*\{\s*/m;
  if (callAPIRe.test(s)) {
    // Inject helper first
    s = inject + s;

    // Add a header merge line right after function open (conservative)
    s = s.replace(callAPIRe, (m) => m + `\n  // __AGK_AUTH_HEADERS_V1__\n  // Force Bearer header for /api/* calls\n`);
    // Also add a runtime merge later by replacing the first "fetch(" occurrence inside callAPI if possible
    s = s.replace(/fetch\s*\(\s*([^\),]+)\s*,\s*([^\)]+)\s*\)/m, (m, a, b) => {
      return `fetch(${a}, (async()=>{ const init = ${b} || {}; const h = new Headers((init && init.headers) || {}); const ah = await __agkGetAuthHeaders(); if (ah && ah.Authorization) h.set("Authorization", ah.Authorization); init.headers = h; return init; })())`;
    });
    out = s;
  } else {
    // If no callAPI, just inject helper at top so dev can wire it later
    out = inject + s;
  }
}

fs.writeFileSync(file, out, "utf8");
console.log("Patched auth helper:", file);
NODE
else
  echo "WARN: could not find API helper file to patch. Still continuing."
fi

echo
echo "== D) Build frontend (best-effort) =="
( cd "$FRONTEND_DIR" && npm run build ) || echo "WARN: build failed"

echo
echo "== E) Deploy hosting (best-effort) =="
( cd "$ROOT_DIR" && firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID" ) || echo "WARN: deploy failed"

echo
echo "== F) Verify live JS no longer contains '/api/api' =="
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

echo
echo "DONE (NOEXIT)."
exit 0
