#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
CLIENT_TS="${CLIENT_TS:-$FRONTEND_DIR/client.ts}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

echo "== Task 7 (v5): Patch BaseClient.callAPI to attach Authorization Bearer token =="
echo "CLIENT:  $CLIENT_TS"
echo "PROJECT: $PROJECT_ID"
echo "SITE:    $HOSTING_SITE"
echo

if [[ ! -f "$CLIENT_TS" ]]; then
  echo "ERROR: missing $CLIENT_TS" >&2
  exit 1
fi

cp -v "$CLIENT_TS" "$CLIENT_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$CLIENT_TS" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Ensure import
if (!s.includes("getAuthHeaders")) {
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt, 0, `import { getAuthHeaders } from "./firebaseAppCheck";`);
  s = lines.join("\n");
}

// 2) Patch callAPI body: find method signature and inject auth merge early
const sig = "public async callAPI(path: string, params?: CallParameters): Promise<Response> {";
const idx = s.indexOf(sig);
if (idx === -1) {
  throw new Error("Could not find BaseClient.callAPI signature in client.ts");
}

// Find opening brace position (end of sig line)
const start = idx + sig.length;
const before = s.slice(0, start);
let after = s.slice(start);

// Avoid double patch
if (after.includes("__AIGK_AUTH_PATCH__")) {
  console.log("ℹ️ callAPI already patched.");
  fs.writeFileSync(file, s, "utf8");
  process.exit(0);
}

// We inject near the top of callAPI, right after it starts.
// This assumes callAPI eventually uses fetch; we just ensure params.headers gets auth.
const inject = `
\n    // __AIGK_AUTH_PATCH__ ensure Authorization header on every API call\n    const __authHeaders = await (async () => {\n        try {\n            return await getAuthHeaders();\n        } catch {\n            return {} as Record<string, string>;\n        }\n    })();\n    if (params) {\n        const h: any = (params as any).headers || {};\n        (params as any).headers = { ...h, ...__authHeaders };\n    } else {\n        params = { headers: { ...__authHeaders } } as any;\n    }\n`;

after = inject + after;

s = before + after;
fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched BaseClient.callAPI to merge getAuthHeaders()");
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
echo "Now test in browser:"
echo "1) Open https://$HOSTING_SITE.web.app/baselines"
echo "2) DevTools -> Network -> click /api/baselines/fs"
echo "3) Confirm Request Headers includes Authorization: Bearer ..."
echo "4) Status should become 200 (or at least not 401)"
