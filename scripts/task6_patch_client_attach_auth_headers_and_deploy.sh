#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

CLIENT_TS="$FRONTEND_DIR/client.ts"

echo "== Task 6: Patch typed client to always attach Authorization headers =="
echo "CLIENT: $CLIENT_TS"
echo "PROJECT: $PROJECT_ID"
echo "SITE: $HOSTING_SITE"
echo

test -f "$CLIENT_TS" || { echo "ERROR: $CLIENT_TS not found"; exit 1; }

cp -v "$CLIENT_TS" "$CLIENT_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$CLIENT_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Ensure import of getAuthHeaders exists
if (!s.includes("getAuthHeaders")) {
  // best-effort insert near top with other imports
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt, 0, `import { getAuthHeaders } from "./firebaseAppCheck";`);
  s = lines.join("\n");
}

// 2) Patch callTypedAPI to merge auth headers into fetch headers
// We look for "async callTypedAPI(" and insert auth merge after options are created
const re = /async\s+callTypedAPI\s*\([\s\S]*?\)\s*:\s*Promise<[\s\S]*?>\s*\{\n/;
const m = s.match(re);
if (!m) {
  throw new Error("Could not find async callTypedAPI(...) in frontend/client.ts");
}

// If already patched, do nothing
if (s.includes("await getAuthHeaders()")) {
  console.log("ℹ️ callTypedAPI already appears to attach auth headers. No patch applied.");
  fs.writeFileSync(file, s, "utf8");
  process.exit(0);
}

// Insert a block right after function opens
s = s.replace(re, (hdr) => {
  return hdr + `  // --- auth headers (injected) ---
  // Attach Authorization: Bearer <idToken> for all backend calls.
  // Safe: if auth isn't ready yet, backend will return 401 and UI can prompt sign-in.
  let __authHeaders: Record<string, string> = {};
  try { __authHeaders = await getAuthHeaders(); } catch { __authHeaders = {}; }
  // --------------------------------
`;
});

// Now we need to ensure these headers are merged into fetch.
// Most generated clients create a "headers" variable or inline headers in fetch.
// We patch the first occurrence of fetch(..., { ... headers: ... }) in callTypedAPI body by
// ensuring __authHeaders are merged.

// Very conservative: replace "headers:" object literal to include ...__authHeaders at the end.
// Handle common patterns:
//   headers: {"Content-Type": "...", ...options.headers}
//   headers: { ...headers }
s = s.replace(
  /headers\s*:\s*\{([\s\S]*?)\}/,
  (all, inner) => {
    // avoid double insert
    if (inner.includes("__authHeaders")) return all;
    // append auth headers at end so they win
    return `headers: {${inner.trim().length ? "\n" + inner.trim() + "\n" : ""}  , ...__authHeaders }`;
  }
);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched callTypedAPI to attach Authorization headers in", file);
NODE

echo
echo "== Build frontend =="
cd "$FRONTEND_DIR"
npm run build

echo
echo "== Deploy hosting =="
cd "$ROOT_DIR"
firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID"

echo
echo "== DONE ✅ =="
echo "Now test:"
echo "1) Open https://$HOSTING_SITE.web.app/baselines"
echo "2) Refresh baselines list"
echo "3) DevTools -> Network: /api/baselines/fs should be 200 (not 401)"
