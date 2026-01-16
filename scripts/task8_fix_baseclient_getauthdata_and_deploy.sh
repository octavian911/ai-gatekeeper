#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
CLIENT_TS="${CLIENT_TS:-$FRONTEND_DIR/client.ts}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

echo "== Task 8: Make BaseClient.getAuthData() attach Bearer token everywhere =="
echo "CLIENT:  $CLIENT_TS"
echo "PROJECT: $PROJECT_ID"
echo "SITE:    $HOSTING_SITE"
echo

cp -v "$CLIENT_TS" "$CLIENT_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$CLIENT_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Ensure getAuthHeaders is imported (from frontend/firebaseAppCheck.ts)
function ensureImport(spec, names) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${spec}["'];`);
  const m = s.match(re);
  if (m) {
    const existing = m[1].split(",").map(x => x.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existing, ...names]));
    s = s.replace(re, `import { ${merged.join(", ")} } from "${spec}";`);
    return;
  }
  // Insert after last import
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i=0;i<lines.length;i++){
    if (lines[i].startsWith("import ")) insertAt = i+1;
    else if (lines[i].trim()==="") continue;
    else break;
  }
  lines.splice(insertAt, 0, `import { ${names.join(", ")} } from "${spec}";`);
  s = lines.join("\n");
}
ensureImport("./firebaseAppCheck", ["getAuthHeaders"]);

// 2) Replace BaseClient.getAuthData() implementation
s = s.replace(
  /async\s+getAuthData\s*\(\)\s*:\s*Promise<CallParameters\s*\|\s*undefined>\s*\{\s*return\s+undefined;\s*\}/m,
  `async getAuthData(): Promise<CallParameters | undefined> {
          // In the browser, attach Firebase Auth ID token as Bearer
          if (typeof window === "undefined") return undefined;
          try {
              const h = await getAuthHeaders();
              return h && Object.keys(h).length ? { headers: h } : undefined;
          } catch {
              // If auth isn't ready yet, let the request proceed (will 401)
              // The UI can retry after auth initializes.
              return undefined;
          }
      }`
);

// 3) Remove the extra getAuthHeaders merge in callTypedAPI (keep /api prefix patch)
s = s.replace(
  /public\s+async\s+callTypedAPI\s*\([\s\S]*?\)\s*:\s*Promise<Response>\s*\{\s*([\s\S]*?)return\s+this\.callAPI\(\s*path,\s*\{\s*([\s\S]*?)\}\s*\);\s*\}/m,
  (full) => {
    // We only want to remove the injected "const authHeaders = await getAuthHeaders();" and the headers merge with authHeaders,
    // but keep everything else.
    let out = full;

    out = out.replace(/^\s*const\s+authHeaders\s*=\s*await\s+getAuthHeaders\(\);\s*\n/m, "");

    out = out.replace(
      /headers:\s*\{\s*\.\.\.\s*authHeaders\s*,\s*"Content-Type"\s*:\s*"application\/json"\s*,\s*\.\.\.\s*params\?\.\s*headers\s*\}/m,
      `headers: { "Content-Type": "application/json", ...params?.headers }`
    );

    return out;
  }
);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched BaseClient.getAuthData() + normalized callTypedAPI");
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
echo "1) Open https://$HOSTING_SITE.web.app/baselines (or your custom domain)"
echo "2) In DevTools Network: /api/baselines/fs should stop being 401 once auth is ready"
echo "3) Hit: /api/__debug/headers and confirm hasAuth=true when called from the app"
