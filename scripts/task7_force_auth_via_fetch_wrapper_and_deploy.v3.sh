#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

MAIN=""
if [[ -f "$FRONTEND_DIR/src/main.tsx" ]]; then
  MAIN="$FRONTEND_DIR/src/main.tsx"
elif [[ -f "$FRONTEND_DIR/src/main.ts" ]]; then
  MAIN="$FRONTEND_DIR/src/main.ts"
else
  echo "ERROR: Could not find frontend/src/main.tsx or main.ts" >&2
  exit 1
fi

echo "== Task 7 (v3): Force Authorization on all same-origin /api/* via fetch wrapper =="
echo "MAIN: $MAIN"
echo "PROJECT: $PROJECT_ID"
echo "SITE: $HOSTING_SITE"
echo

cp -v "$MAIN" "$MAIN.bak.$(date +%Y%m%d-%H%M%S)"

node - "$MAIN" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// Ensure import getAuthHeaders exists
if (!s.includes("getAuthHeaders")) {
  // Try common relative paths
  const candidates = [
    `import { getAuthHeaders } from "../firebaseAppCheck";`,
    `import { getAuthHeaders } from "./firebaseAppCheck";`,
    `import { getAuthHeaders } from "../firebaseAppCheck.ts";`,
    `import { getAuthHeaders } from "./firebaseAppCheck.ts";`,
  ];
  // Pick the one that exists by heuristic: your file is frontend/firebaseAppCheck.ts (NOT under src)
  // So from src/main.tsx -> ../firebaseAppCheck
  const imp = `import { getAuthHeaders } from "../firebaseAppCheck";`;
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt, 0, imp);
  s = lines.join("\n");
}

// Avoid double patch
if (s.includes("window.__AIGK_FETCH_WRAPPED__")) {
  console.log("ℹ️ fetch wrapper already present; skipping.");
  process.exit(0);
}

const wrapper = `
/**
 * Global fetch wrapper: attach Authorization Bearer token to SAME-ORIGIN /api/* requests.
 * This fixes typed client calls that weren't attaching auth.
 */
declare global {
  interface Window { __AIGK_FETCH_WRAPPED__?: boolean; }
}

if (typeof window !== "undefined" && !window.__AIGK_FETCH_WRAPPED__) {
  window.__AIGK_FETCH_WRAPPED__ = true;

  const _fetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      // Determine URL safely
      let urlStr = "";
      if (typeof input === "string") urlStr = input;
      else if (input instanceof URL) urlStr = input.toString();
      else if (input instanceof Request) urlStr = input.url;

      const url = new URL(urlStr, window.location.origin);

      // Only same-origin /api/*
      const isSameOrigin = url.origin === window.location.origin;
      const isApi = url.pathname.startsWith("/api/");
      if (!isSameOrigin || !isApi) return _fetch(input as any, init);

      // If Authorization already present, don't override
      const existingAuth =
        (init?.headers && (init.headers as any)["Authorization"]) ||
        (init?.headers && (init.headers as any)["authorization"]) ||
        (input instanceof Request && input.headers.get("Authorization")) ||
        (input instanceof Request && input.headers.get("authorization"));

      if (existingAuth) return _fetch(input as any, init);

      const authHeaders = await getAuthHeaders().catch(() => ({} as Record<string,string>));
      const mergedHeaders = { ...(init?.headers as any), ...authHeaders };

      // If input is a Request, create a new Request so headers apply
      if (input instanceof Request) {
        const req2 = new Request(input, { ...init, headers: mergedHeaders });
        return _fetch(req2, undefined);
      }

      return _fetch(input as any, { ...(init || {}), headers: mergedHeaders });
    } catch {
      // Never block fetch; fall back
      return _fetch(input as any, init);
    }
  };
}
`;

// Insert wrapper after imports, before app bootstraps
const lines = s.split("\n");
let insertAt = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith("import ")) insertAt = i + 1;
  else break;
}
lines.splice(insertAt, 0, wrapper.trim());
s = lines.join("\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Inserted global fetch wrapper in", file);
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
echo "Test:"
echo "1) Open https://$HOSTING_SITE.web.app/baselines"
echo "2) DevTools -> Network -> /api/baselines/fs should stop returning 401"
echo "3) Hit /api/__debug/headers and confirm hasAuth:true for app calls"
