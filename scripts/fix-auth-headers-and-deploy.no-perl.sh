#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

CLIENT_TS="$FRONTEND_DIR/client.ts"

FIREBASE_APPCHECK_FILE=""
if [[ -f "$FRONTEND_DIR/firebaseAppCheck.ts" ]]; then
  FIREBASE_APPCHECK_FILE="$FRONTEND_DIR/firebaseAppCheck.ts"
elif [[ -f "$FRONTEND_DIR/firebaseAppCheck.tsx" ]]; then
  FIREBASE_APPCHECK_FILE="$FRONTEND_DIR/firebaseAppCheck.tsx"
else
  echo "ERROR: Can't find frontend/firebaseAppCheck.ts(x)."
  exit 1
fi

note(){ echo -e "\n== $* =="; }
die(){ echo "ERROR: $*" >&2; exit 1; }

note "Fix auth headers for /api calls + build + deploy (NO perl)"
echo "PROJECT_ID:   $PROJECT_ID"
echo "ROOT_DIR:     $ROOT_DIR"
echo "FRONTEND_DIR: $FRONTEND_DIR"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "AppCheck file: $FIREBASE_APPCHECK_FILE"
echo "Client file:  $CLIENT_TS"

[[ -d "$ROOT_DIR" ]] || die "Missing ROOT_DIR: $ROOT_DIR"
[[ -d "$FRONTEND_DIR" ]] || die "Missing FRONTEND_DIR: $FRONTEND_DIR"
[[ -f "$CLIENT_TS" ]] || die "Missing $CLIENT_TS"

TS="$(date +%Y%m%d-%H%M%S)"

note "1) Ensure firebaseAppCheck exports getAuthHeaders()"
if node --input-type=commonjs -e "const fs=require('fs');const t=fs.readFileSync(process.argv[1],'utf8');process.exit(t.includes('export async function getAuthHeaders(')?0:1)" "$FIREBASE_APPCHECK_FILE"; then
  echo "✅ getAuthHeaders() already exists"
else
  cp -v "$FIREBASE_APPCHECK_FILE" "$FIREBASE_APPCHECK_FILE.bak.$TS"
  cat >> "$FIREBASE_APPCHECK_FILE" <<'TSX'

/**
 * Returns headers needed for authenticated API calls.
 * Uses Firebase Auth ID token (works for anonymous users too, if enabled).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn("getAuthHeaders() failed:", e);
  }
  return headers;
}
TSX
  echo "✅ Added getAuthHeaders()"
fi

note "2) Patch frontend/client.ts to attach Authorization on /api calls"
cp -v "$CLIENT_TS" "$CLIENT_TS.bak.$TS"

node --input-type=commonjs - "$CLIENT_TS" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("ERROR: missing client.ts path argument");
  process.exit(1);
}

let src = fs.readFileSync(file, "utf8");

// Ensure import exists
if (!src.includes('getAuthHeaders')) {
  const m = src.match(/^(?:import[^\n]*\n)+/);
  const insert = `import { getAuthHeaders } from "./firebaseAppCheck";\n`;
  if (m) src = src.slice(0, m[0].length) + insert + src.slice(m[0].length);
  else src = insert + src;
}

// Locate callTypedAPI function boundaries
const startIdx = src.search(/async\s+callTypedAPI\s*\(/);
if (startIdx === -1) {
  console.error("ERROR: Could not find async callTypedAPI( in client.ts");
  process.exit(1);
}

const braceOpen = src.indexOf("{", startIdx);
if (braceOpen === -1) {
  console.error("ERROR: Could not find opening { for callTypedAPI");
  process.exit(1);
}

// Walk to matching closing brace
let i = braceOpen, depth = 0;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === "{") depth++;
  else if (ch === "}") {
    depth--;
    if (depth === 0) { i++; break; }
  }
}
if (depth !== 0) {
  console.error("ERROR: Unbalanced braces while parsing callTypedAPI");
  process.exit(1);
}

const before = src.slice(0, braceOpen + 1);
let body = src.slice(braceOpen + 1, i - 1);
const after = src.slice(i - 1);

// Inject authHeaders near top of function body (only once)
if (!body.includes("const authHeaders = await getAuthHeaders()")) {
  body = `\n    const authHeaders = await getAuthHeaders();\n` + body;
}

// If there's already a headers object in fetch options, merge it.
// Otherwise, inject headers: authHeaders into the first fetch(..., { ... }) options object.
if (/headers\s*:/.test(body)) {
  body = body.replace(/headers\s*:\s*\{/, () => `headers: { ...authHeaders, `);
} else {
  body = body.replace(/fetch\s*\(\s*([^,]+)\s*,\s*\{/, (m) => `${m}\n      headers: authHeaders,`);
}

const out = before + body + after;
fs.writeFileSync(file, out, "utf8");
console.log("✅ client.ts patched to include Authorization headers.");
NODE

note "3) Build frontend"
( cd "$FRONTEND_DIR" && npm run build )

note "4) Deploy functions:api"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "5) Deploy hosting:${HOSTING_SITE}"
npx -y firebase-tools deploy --only "hosting:${HOSTING_SITE}" --project "$PROJECT_ID"

note "DONE ✅"
echo "Now verify in browser DevTools -> Network -> /api request headers:"
echo "  Authorization: Bearer <token>"
