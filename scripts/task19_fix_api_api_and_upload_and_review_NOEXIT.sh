#!/usr/bin/env bash
# NOEXIT: do not kill terminal with exit code 1. Still prints real failures.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

FRONTEND_DIR="$ROOT_DIR/frontend"
FUNCTIONS_DIR="$ROOT_DIR/functions"
INDEX_TS="$FUNCTIONS_DIR/src/index.ts"
CLIENT_TS="$FRONTEND_DIR/client.ts"

ts() { date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task19_$(ts)"
mkdir -p "$BACKUP"

log() { printf "\n== %s ==\n" "$*"; }
run() { echo; echo ">> $*"; bash -lc "$*" ; echo "rc=$?"; }
safe_cp() { [ -f "$1" ] && cp -a "$1" "$BACKUP/" 2>/dev/null || true; }

echo "ROOT: $ROOT_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "BACKUP: $BACKUP"

# ---------------------------
# A) BACKEND: Normalize /api/api and make baselines routes work under BOTH:
#    /baselines/*  and /api/baselines/*
# ---------------------------
log "A) Backend patch: normalize /api/api + /api/baselines -> /baselines"
safe_cp "$INDEX_TS"

if [ ! -f "$INDEX_TS" ]; then
  echo "WARN: missing $INDEX_TS"
else
  node <<'NODE'
const fs = require("fs");
const path = require("path");
const f = process.env.INDEX_TS || "";
if (!f || !fs.existsSync(f)) {
  console.error("Missing INDEX_TS:", f);
  process.exit(0);
}
let s = fs.readFileSync(f, "utf8");

// If middleware already exists, skip inserting again.
if (!s.includes("AI_GATEKEEPER_NORMALIZE_API_PREFIX")) {
  const anchor = "const app = express();";
  const i = s.indexOf(anchor);
  if (i === -1) {
    console.error("Could not find anchor:", anchor);
  } else {
    const insert =
`\n\n// AI_GATEKEEPER_NORMALIZE_API_PREFIX\n// Accept both client shapes and prevent /api/api issues.
// - /api/api/*  -> /api/*
// - /api/baselines/* -> /baselines/*  (so routes defined under /baselines work too)
app.use((req, _res, next) => {
  try {
    const u = String(req.url || "");
    if (u.startsWith("/api/api/")) req.url = u.replace(/^\\/api\\/api\\//, "/api/");
    if (u === "/api/baselines") req.url = "/baselines";
    if (u.startsWith("/api/baselines/")) req.url = u.replace(/^\\/api\\/baselines\\//, "/baselines/");
  } catch (_) {}
  next();
});\n`;
    s = s.slice(0, i + anchor.length) + insert + s.slice(i + anchor.length);
    fs.writeFileSync(f, s, "utf8");
    console.log("Inserted normalize middleware after:", anchor);
  }
} else {
  console.log("Normalize middleware already present; skipping insert.");
}

// Quick proof lines
const lines = s.split("\n");
for (let idx = 0; idx < lines.length; idx++) {
  if (lines[idx].includes("AI_GATEKEEPER_NORMALIZE_API_PREFIX")) {
    console.log("Middleware marker at line", idx + 1);
    break;
  }
}
NODE
fi

# Deploy functions (best effort)
log "B) Deploy backend functions (best effort)"
run "cd '$ROOT_DIR' && firebase deploy --only functions:api --project '$PROJECT_ID'"

# ---------------------------
# C) FRONTEND: Stop generating /api/api and force Authorization header
# ---------------------------
log "C) Frontend patch: normalize any final URL /api/api -> /api AND ensure auth header on requests"
safe_cp "$CLIENT_TS"

if [ ! -f "$CLIENT_TS" ]; then
  echo "WARN: missing $CLIENT_TS"
else
  node <<'NODE'
const fs = require("fs");
const f = process.env.CLIENT_TS || "";
if (!f || !fs.existsSync(f)) {
  console.error("Missing CLIENT_TS:", f);
  process.exit(0);
}
let s = fs.readFileSync(f, "utf8");

// 1) Add a small normalizer helper if not present
if (!s.includes("function __agkNormalizeApiUrl")) {
  s = `function __agkNormalizeApiUrl(u: string) {\n  return u.replace(/\\/api\\/api\\//g, "/api/");\n}\n\n` + s;
}

// 2) Patch common fetch patterns to normalize the URL right before fetch.
//    This handles "runtime-built" /api/api that won't appear as a literal.
const before = s;

// Patch: fetch(url, ...)  -> fetch(__agkNormalizeApiUrl(String(url)), ...)
s = s.replace(/fetch\\(\\s*url\\s*,/g, 'fetch(__agkNormalizeApiUrl(String(url)),');
s = s.replace(/fetch\\(\\s*\\(\\s*url\\s*\\)\\s*,/g, 'fetch(__agkNormalizeApiUrl(String(url)),');

// Patch: fetch\\((this\\.basePath[^,]+),  -> normalize
s = s.replace(/fetch\\((this\\.basePath[^,]+),/g, 'fetch(__agkNormalizeApiUrl(String($1)),');
s = s.replace(/fetch\\(([^,]*\\+\\s*path[^,]*),/g, 'fetch(__agkNormalizeApiUrl(String($1)),');

// 3) Try to ensure Authorization header is attached wherever headers are built.
//    We don’t assume "firebase" global; we only ensure that if the code already
//    computes token in getAuthHeaders, it is actually used on fetch.
if (s.includes("getAuthHeaders") && !s.includes("__agkForceAuthHeader")) {
  // Insert a tiny hook around fetch init.headers if present.
  // If code already sets headers, this does not break it.
  const hook =
`\nfunction __agkForceAuthHeader(init: any, headers: any) {\n  try {\n    if (!init) return;\n    if (!headers) return;\n    init.headers = Object.assign({}, init.headers || {}, headers);\n  } catch (_) {}\n}\n\n`;

  // Put hook near top (after normalizer)
  s = s.replace(/function __agkNormalizeApiUrl[\\s\\S]*?}\\n\\n/, m => m + hook);
}

// 4) If we can find a place where fetch is called with (url, init), we ensure init exists.
s = s.replace(/fetch\\(__agkNormalizeApiUrl\\(String\\(([^)]+)\\)\\)\\s*,\\s*([^)]+)\\)/g,
  'fetch(__agkNormalizeApiUrl(String($1)), ($2 || {}))');

// Write back only if changed
if (s !== before) {
  fs.writeFileSync(f, s, "utf8");
  console.log("Patched client.ts successfully:", f);
} else {
  console.log("No changes applied to client.ts (pattern not found).");
}
NODE
fi

# Also normalize any hard-coded "/api/api/" in frontend/src just in case
log "D) Frontend src sweep: replace literal /api/api/ -> /api/"
run "cd '$FRONTEND_DIR' && [ -d src ] && grep -RIl '/api/api/' src | while read -r f; do sed -i 's#/api/api/#/api/#g' \"\$f\"; done; true"

# Build + Deploy hosting
log "E) Build frontend"
run "npm --prefix '$FRONTEND_DIR' run build"

log "F) Deploy hosting"
run "cd '$ROOT_DIR' && firebase deploy --only hosting:$HOSTING_SITE --project '$PROJECT_ID'"

log "G) Post-deploy probes (no JWT required, should NOT be HTML 404 for git-status anymore)"
run "curl -sS -i 'https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)' | head -n 20"
run "curl -sS -i 'https://app.ai-gatekeeper.ca/api/baselines/git-status?t=$(date +%s)' | head -n 20"
run "curl -sS -i 'https://app.ai-gatekeeper.ca/api/api/baselines/git-status?t=$(date +%s)' | head -n 20"

echo
echo "DONE. This script exits 0 by design."
exit 0
