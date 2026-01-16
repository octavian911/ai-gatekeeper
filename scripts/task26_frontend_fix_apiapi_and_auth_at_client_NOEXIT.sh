#!/usr/bin/env bash
# NOEXIT: always exits 0 (never returns exit code 1)
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task26_frontend_$(ts)"
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

echo
echo "== 1) Locate API client file by searching for callAPI/callTypedAPI/APIError =="
SRC_ROOT="$FRONTEND_DIR/src"
if [ ! -d "$SRC_ROOT" ]; then
  echo "WARN: $SRC_ROOT not found. Searching whole frontend folder."
  SRC_ROOT="$FRONTEND_DIR"
fi

CANDIDATES="$(grep -RIl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' -E 'callTypedAPI|function callAPI|callAPI\s*=|APIError' "$SRC_ROOT" 2>/dev/null | head -n 25)"
echo "$CANDIDATES" | sed 's/^/CANDIDATE: /'

TARGET="$(echo "$CANDIDATES" | head -n 1)"
if [ -z "$TARGET" ] || [ ! -f "$TARGET" ]; then
  echo "WARN: Could not find API client file. Exiting 0."
  exit 0
fi
echo "TARGET: $TARGET"

echo
echo "== 2) Backup target file =="
cp -a "$TARGET" "$BACKUP/" 2>/dev/null || true

echo
echo "== 3) Patch URL normalization + Authorization attachment at the fetch wrapper =="
node - "$TARGET" <<'NODE' || true
const fs = require("fs");
const file = process.argv[2];
if (!file || !fs.existsSync(file)) process.exit(0);

let s = fs.readFileSync(file, "utf8");
if (s.includes("__AGK_CLIENT_PATCH_V1__")) {
  console.log("Already patched:", file);
  process.exit(0);
}

/**
 * We patch in the narrowest, safest way:
 * - Ensure request URL never becomes /api/api/...
 * - Ensure Authorization: Bearer <firebase idToken> is attached when available
 * - If code already has a getAuthHeaders() or similar, we inject a wrapper.
 */

function injectHelpers(src) {
  const helper =
`\n// __AGK_CLIENT_PATCH_V1__
// Normalize API paths so we never produce "/api/api/...".
function __agkNormalizeApiPath(p) {
  if (!p) return p;
  // Keep absolute URLs as-is.
  if (/^https?:\\/\\//i.test(p)) return p;
  // Collapse any accidental double prefix.
  p = p.replace(/^\\/api\\/api\\//, "/api/");
  // If caller already passed "/api/...", keep it.
  if (p.startsWith("/api/")) return p;
  // If caller passed "/baselines/..." or similar, prefix once.
  if (!p.startsWith("/")) p = "/" + p;
  return "/api" + p;
}

async function __agkGetBearer() {
  try {
    const mod = await import("firebase/auth");
    const auth = mod.getAuth();
    const deadline = Date.now() + 6000; // wait up to 6s
    while (!auth.currentUser && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (!auth.currentUser) return null;
    const tok = await auth.currentUser.getIdToken();
    return tok ? ("Bearer " + tok) : null;
  } catch (e) {
    return null;
  }
}

function __agkAttachAuth(init, bearer) {
  const out = init ? { ...init } : {};
  const h = new Headers((out.headers) || {});
  if (bearer) h.set("Authorization", bearer);
  out.headers = h;
  return out;
}\n`;

  // Put helpers near top (after imports if any).
  const importBlock = src.match(/^(?:import[\\s\\S]*?;\\s*)+/m);
  if (importBlock) {
    return src.replace(importBlock[0], importBlock[0] + helper);
  }
  return helper + src;
}

function patchFetchInFunction(src, fnName) {
  // Find function body start for fnName, then patch first fetch(...) inside it.
  // This is heuristic but works well for typical wrappers.
  const re = new RegExp(`(function\\s+${fnName}\\s*\$begin:math:text$\[\^\\$end:math:text$]*\\)\\s*\\{[\\s\\S]*?)\\bfetch\\s*\\(`, "m");
  if (!re.test(src)) return null;

  // Ensure we normalize whatever variable is used as path:
  // We add: path = __agkNormalizeApiPath(path)
  // and wrap fetch init with bearer.
  // We do this by injecting a few lines after function opening brace.
  const openRe = new RegExp(`function\\s+${fnName}\\s*\\([^\\)]*\\)\\s*\\{`, "m");
  if (!openRe.test(src)) return null;

  src = src.replace(openRe, (m) => m + `\n  // __AGK_CLIENT_PATCH_V1__\n`);

  // Normalize common parameter names if present: path/url/endpoint
  // We'll add a safe normalization line that checks those names in order.
  const norm =
`  // Normalize path to avoid "/api/api"
  if (typeof path === "string") path = __agkNormalizeApiPath(path);
  if (typeof url === "string") url = __agkNormalizeApiPath(url);
  if (typeof endpoint === "string") endpoint = __agkNormalizeApiPath(endpoint);\n`;

  src = src.replace(openRe, (m) => m + "\n" + norm);

  // Replace first fetch(arg1, arg2) inside function with async init wrapper.
  // We keep it minimal: compute bearer once, then attach.
  src = src.replace(/fetch\\s*\\(\\s*([^,\\)]+)\\s*,\\s*([^\\)]+)\\s*\\)/m, (m, a1, a2) => {
    return `(async()=>{ const bearer = await __agkGetBearer(); const init = __agkAttachAuth(${a2} || {}, bearer); return fetch(${a1}, init); })()`;
  });

  return src;
}

// 1) Inject helpers once
s = injectHelpers(s);

// 2) Patch known wrappers if they exist
let out = s;
const tryFns = ["callAPI", "callTypedAPI"];
for (const fn of tryFns) {
  const patched = patchFetchInFunction(out, fn);
  if (patched) out = patched;
}

// 3) As fallback, patch any literal "/api/api" strings
out = out.replace(/\\/api\\/api\\//g, "/api/");

fs.writeFileSync(file, out, "utf8");
console.log("Patched:", file);
NODE

echo
echo "== 4) Build frontend (best-effort) =="
( cd "$FRONTEND_DIR" && npm run build ) || echo "WARN: build failed"

echo
echo "== 5) Deploy hosting (best-effort) =="
( cd "$ROOT_DIR" && firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID" ) || echo "WARN: deploy failed"

echo
echo "== 6) Verify LIVE JS no longer contains 'api/api' =="
ASSET_PATH="$(curl -sS https://app.ai-gatekeeper.ca/baselines \
  | tr '"' '\n' \
  | grep -E '^/assets/index-.*\.js$' \
  | head -n 1)"
echo "Live asset: $ASSET_PATH"
if [ -n "$ASSET_PATH" ]; then
  HIT="$(curl -sS "https://app.ai-gatekeeper.ca${ASSET_PATH}" | grep -n "api/api" | head -n 10)"
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
echo "DONE (NOEXIT)"
exit 0
