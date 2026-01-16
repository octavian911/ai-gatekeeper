#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

CLIENT_TS="$FRONTEND_DIR/client.ts"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

note "Permanent Fix: /api prefix patch goes INSIDE callTypedAPI() body (fix build + routing)"
echo "PROJECT_ID:   $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "CLIENT_TS:    $CLIENT_TS"

[[ -f "$CLIENT_TS" ]] || die "Missing $CLIENT_TS"

note "1) Backup client.ts"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$CLIENT_TS" "$CLIENT_TS.bak.$TS"

note "2) Remove any bad previous injection + re-inject correctly"
CLIENT_TS="$CLIENT_TS" node <<'NODE'
const fs = require("fs");

const file = process.env.CLIENT_TS;
if (!file) throw new Error("CLIENT_TS env missing");

let s = fs.readFileSync(file, "utf8");

// 1) Remove any previous injected block (wherever it landed)
// Match from marker to end of the FIRST closing brace of the injected if-block.
const injectedBlock = /\n[ \t]*\/\/ __API_PREFIX_PATCH__[\s\S]*?\n[ \t]*}\n/gm;
if (injectedBlock.test(s)) {
  s = s.replace(injectedBlock, "\n");
}

// 2) Prepare the injection (kept small + idempotent)
const insert = `
    // __API_PREFIX_PATCH__
    // Force API calls through Firebase Hosting rewrite: /api/** -> function "api"
    // Avoid double-prefix and ignore absolute URLs.
    if (!/^https?:\\/\\//.test(path) && !path.startsWith("/api/")) {
      path = "/api" + (path.startsWith("/") ? path : "/" + path);
    }
`;

// 3) Find the *definition* of callTypedAPI and insert right after its BODY "{"
const patterns = [
  // Method: async callTypedAPI(...) { ... }
  /(^[ \t]*(?:public|private|protected)?[ \t]*(?:async[ \t]+)?callTypedAPI[ \t]*\([^)]*\)[^{]*\{)/m,
  // Class prop: callTypedAPI = async (...) => { ... }
  /(^[ \t]*callTypedAPI[ \t]*=[ \t]*(?:async[ \t]*)?\([^)]*\)[ \t]*=>[ \t]*\{)/m,
  // Object prop: callTypedAPI: async (...) => { ... }
  /(^[ \t]*callTypedAPI[ \t]*:[ \t]*(?:async[ \t]*)?\([^)]*\)[ \t]*=>[ \t]*\{)/m,
];

let matched = false;
for (const re of patterns) {
  const m = s.match(re);
  if (m) {
    // If patch already exists inside the function body, don’t re-add.
    // (We removed earlier blocks globally, but keep this safe.)
    const startIdx = s.indexOf(m[1]) + m[1].length;
    const window = s.slice(startIdx, Math.min(startIdx + 1200, s.length));
    if (!window.includes("__API_PREFIX_PATCH__")) {
      s = s.replace(re, `$1${insert}`);
    }
    matched = true;
    break;
  }
}

if (!matched) {
  throw new Error("Could not locate callTypedAPI definition in client.ts (no safe patch applied).");
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ client.ts fixed: bad injection removed + /api prefix injected inside callTypedAPI() body.");
NODE

note "3) Build frontend"
npm --prefix "$FRONTEND_DIR" run build

note "4) Deploy hosting (so new bundle goes live)"
npx -y firebase-tools deploy --only "hosting:${HOSTING_SITE}" --project "$PROJECT_ID"

note "DONE ✅"
echo
echo "Now test in browser:"
echo "  https://${HOSTING_SITE}.web.app/baselines"
echo "Try upload again and confirm Network shows requests like:"
echo "  https://${HOSTING_SITE}.web.app/api/..."
echo "NOT:"
echo "  https://${HOSTING_SITE}.web.app/upload-multi-fs"
