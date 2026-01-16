#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
CLIENT_TS="${CLIENT_TS:-$FRONTEND_DIR/client.ts}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

echo "== Task 7: FORCE typed client to attach Authorization on every call =="
echo "CLIENT: $CLIENT_TS"
echo "PROJECT: $PROJECT_ID"
echo "SITE:   $HOSTING_SITE"
echo

test -f "$CLIENT_TS" || { echo "ERROR: client.ts not found at $CLIENT_TS" >&2; exit 1; }

cp -v "$CLIENT_TS" "$CLIENT_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$CLIENT_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Ensure import of getAuthHeaders from ./firebaseAppCheck (client.ts is at frontend root in your repo)
if (!s.includes("getAuthHeaders")) {
  // insert after last import
  const lines = s.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) if (/^\s*import\b/.test(lines[i])) lastImport = i;

  const importLine = `import { getAuthHeaders } from "./firebaseAppCheck";`;
  if (lastImport >= 0) lines.splice(lastImport + 1, 0, importLine);
  else lines.unshift(importLine);

  s = lines.join("\n");
}

// 2) Patch callTypedAPI to merge auth headers.
// We look for a function/method named callTypedAPI( ... ) { ... fetch( ... ) }
const re = /(async\s+callTypedAPI\s*\([\s\S]*?\)\s*:\s*Promise<[\s\S]*?\{\s*)([\s\S]*?)(\n\s*\}\s*)/m;
let m = s.match(re);

if (!m) {
  // fallback: match without return type
  const re2 = /(async\s+callTypedAPI\s*\([\s\S]*?\)\s*\{\s*)([\s\S]*?)(\n\s*\}\s*)/m;
  m = s.match(re2);
  if (!m) {
    throw new Error("Could not find callTypedAPI(...) function in client.ts. Paste it and I’ll patch it precisely.");
  }
}

// If already forced, skip idempotently
if (s.includes("AI_GATEKEEPER_FORCE_AUTH_HEADERS")) {
  console.log("ℹ️ client.ts already has forced auth headers patch.");
  process.exit(0);
}

// Inside callTypedAPI body, we need to locate where headers are assembled.
// We'll inject a small block near the top of the function body, before fetch.
let body = m[2];

// Heuristic: find the first occurrence of "const" or "let" and inject after it, otherwise inject at start.
const inject = `
// ===== AI_GATEKEEPER_FORCE_AUTH_HEADERS =====
// Always attach Firebase Auth ID token as Authorization: Bearer <token>
const __authHeaders = await getAuthHeaders().catch(() => ({} as Record<string, string>));
// ===== /AI_GATEKEEPER_FORCE_AUTH_HEADERS =====
`;

if (!body.includes("__authHeaders")) {
  body = inject + body;
}

// Now ensure when headers are passed to fetch, __authHeaders are merged.
// We do a conservative replace: any occurrence of "headers:" in the options object gets wrapped.
// This avoids breaking FormData (we do NOT set Content-Type).
body = body.replace(/headers\s*:\s*([A-Za-z0-9_$.()\[\]{}:\s,"'`+-]+)(,|\s*\})/g, (full, hdrExpr, tail) => {
  // If it already merges __authHeaders, leave it
  if (full.includes("__authHeaders")) return full;
  return `headers: { ...(${hdrExpr.trim()} as any), ...__authHeaders }${tail}`;
});

// If there was no headers: in fetch options at all, we add it by patching "fetch(url, {"
if (!body.includes("headers:")) {
  body = body.replace(/fetch\s*$begin:math:text$\\s\*\(\[\^$end:math:text$,]+)\s*,\s*\{\s*/m, (full) => full + `headers: { ...__authHeaders }, `);
}

s = s.replace(m[0], m[1] + body + m[3]);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched client.ts: callTypedAPI now forces Authorization headers.");
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
echo "Next check:"
echo "1) Open https://$HOSTING_SITE.web.app/baselines"
echo "2) DevTools → Network → /api/baselines/fs"
echo "3) Request Headers MUST include: Authorization: Bearer ..."
echo "4) Response should be 200 (or at least NOT 401)."
