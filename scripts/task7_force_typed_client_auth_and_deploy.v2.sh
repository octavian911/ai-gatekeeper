#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
CLIENT_TS="${CLIENT_TS:-$FRONTEND_DIR/client.ts}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

echo "== Task 7 (v2): FORCE typed client to attach Authorization on every call =="
echo "CLIENT:  $CLIENT_TS"
echo "PROJECT: $PROJECT_ID"
echo "SITE:    $HOSTING_SITE"
echo

[[ -f "$CLIENT_TS" ]] || { echo "ERROR: client.ts not found at $CLIENT_TS" >&2; exit 1; }

cp -v "$CLIENT_TS" "$CLIENT_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$CLIENT_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Ensure import { getAuthHeaders } exists
const importLine = `import { getAuthHeaders } from "./firebaseAppCheck";`;
if (!s.includes(importLine)) {
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt, 0, importLine);
  s = lines.join("\n");
}

// 2) Find callTypedAPI (or fallback to callAPI) and inject auth header merge
function patchCall(fnName) {
  const idx = s.indexOf(`async ${fnName}(`);
  if (idx === -1) return false;

  // Extract a window to patch (simple, but robust enough)
  const start = idx;
  const end = s.indexOf("\n}", idx); // end of method (approx)
  if (end === -1) return false;

  const chunk = s.slice(start, end + 2);

  // If already patched, skip
  if (chunk.includes("__authHeaders") && chunk.includes("getAuthHeaders")) return true;

  // Must contain a fetch(...) in this method
  if (!chunk.includes("fetch(")) return false;

  // Inject authHeaders near the top of the method body
  const brace = chunk.indexOf("{");
  if (brace === -1) return false;

  let patched = chunk;
  const inject = `\n    const __authHeaders = await getAuthHeaders().catch(() => ({} as Record<string,string>));\n`;
  patched = patched.slice(0, brace + 1) + inject + patched.slice(brace + 1);

  // Merge into headers object inside fetch init
  // Look for "headers:" inside the method chunk
  const hpos = patched.indexOf("headers:");
  if (hpos === -1) {
    // If no headers at all, add headers into fetch init object (best effort)
    const fpos = patched.indexOf("fetch(");
    const brace2 = patched.indexOf("{", fpos);
    if (brace2 === -1) return false;
    patched = patched.slice(0, brace2 + 1) + `\n        headers: { ...__authHeaders },` + patched.slice(brace2 + 1);
  } else {
    // If headers: { ... } exists, inject ...__authHeaders at the END of that object
    const objStart = patched.indexOf("{", hpos);
    if (objStart === -1) return false;

    // Find matching closing brace for that headers object (naive but works for flat objects)
    let depth = 0, i = objStart;
    for (; i < patched.length; i++) {
      const c = patched[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) return false;

    const before = patched.slice(0, i);
    const after = patched.slice(i);
    // avoid double insert
    if (!before.includes("...__authHeaders")) {
      patched = before + `,\n          ...__authHeaders` + after;
    }
  }

  s = s.slice(0, start) + patched + s.slice(end + 2);
  return true;
}

let ok = patchCall("callTypedAPI");
if (!ok) ok = patchCall("callAPI");

if (!ok) {
  console.error("ERROR: Could not find a patchable callTypedAPI()/callAPI() with fetch() inside. Please open client.ts and search for 'async callTypedAPI' and 'fetch(' to confirm structure.");
  process.exit(2);
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched typed client to attach Authorization headers.");
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
echo "Now re-test in browser:"
echo "1) Open https://$HOSTING_SITE.web.app/baselines"
echo "2) DevTools → Network → GET /api/baselines/fs should be 200 (or at least not 401)"
echo "3) GET /api/__debug/headers should show hasAuth:true when called by the app"
