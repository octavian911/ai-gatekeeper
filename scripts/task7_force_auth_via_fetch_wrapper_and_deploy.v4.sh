#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

echo "== Task 7 (v4): Force Authorization on all same-origin /api/* via fetch wrapper =="
echo "PROJECT: $PROJECT_ID"
echo "SITE:    $HOSTING_SITE"
echo

# Find a likely Vite/React entry file
ENTRY="$(grep -RIl --exclude-dir=node_modules --exclude-dir=dist -E 'createRoot\(|ReactDOM\.render\(' "$FRONTEND_DIR/src" 2>/dev/null | head -n 1 || true)"
if [[ -z "${ENTRY:-}" ]]; then
  echo "ERROR: Could not auto-find entry file in $FRONTEND_DIR/src (no createRoot()/ReactDOM.render found)." >&2
  echo "Run: ls -la $FRONTEND_DIR/src && grep -RIn -E 'createRoot\\(|ReactDOM\\.render\\(' $FRONTEND_DIR/src" >&2
  exit 1
fi

APPCHECK="$FRONTEND_DIR/firebaseAppCheck.ts"
if [[ ! -f "$APPCHECK" ]]; then
  echo "ERROR: Missing $APPCHECK (expected getAuthHeaders there)." >&2
  exit 1
fi

echo "ENTRY:   $ENTRY"
echo "APPCHECK:$APPCHECK"
echo

cp -v "$ENTRY" "$ENTRY.bak.$(date +%Y%m%d-%H%M%S)"

node - "$ENTRY" "$APPCHECK" <<'NODE'
const fs = require("fs");
const path = require("path");

const entry = process.argv[2];
const appcheck = process.argv[3];

let s = fs.readFileSync(entry, "utf8");

// avoid double patch
if (s.includes("window.__AIGK_FETCH_WRAPPED__")) {
  console.log("ℹ️ fetch wrapper already present in", entry);
  process.exit(0);
}

// compute correct relative import from entry to appcheck
const rel = path.relative(path.dirname(entry), appcheck).replace(/\\/g, "/");
const importPath = rel.startsWith(".") ? rel : "./" + rel;
const importLine = `import { getAuthHeaders } from "${importPath.replace(/\.ts$/, "")}";`;

// Insert import if missing
if (!s.includes("getAuthHeaders")) {
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt, 0, importLine);
  s = lines.join("\n");
}

// Wrapper
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
      let urlStr = "";
      if (typeof input === "string") urlStr = input;
      else if (input instanceof URL) urlStr = input.toString();
      else if (input instanceof Request) urlStr = input.url;

      const url = new URL(urlStr, window.location.origin);
      const isSameOrigin = url.origin === window.location.origin;
      const isApi = url.pathname.startsWith("/api/");
      if (!isSameOrigin || !isApi) return _fetch(input as any, init);

      const existingAuth =
        (init?.headers && (init.headers as any)["Authorization"]) ||
        (init?.headers && (init.headers as any)["authorization"]) ||
        (input instanceof Request && input.headers.get("Authorization")) ||
        (input instanceof Request && input.headers.get("authorization"));

      if (existingAuth) return _fetch(input as any, init);

      const authHeaders = await getAuthHeaders().catch(() => ({} as Record<string,string>));
      const mergedHeaders = { ...(init?.headers as any), ...authHeaders };

      if (input instanceof Request) {
        const req2 = new Request(input, { ...init, headers: mergedHeaders });
        return _fetch(req2, undefined);
      }

      return _fetch(input as any, { ...(init || {}), headers: mergedHeaders });
    } catch {
      return _fetch(input as any, init);
    }
  };
}
`.trim();

// Insert wrapper after imports
{
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt, 0, "", wrapper, "");
  s = lines.join("\n");
}

fs.writeFileSync(entry, s, "utf8");
console.log("✅ Patched entry + added fetch wrapper:", entry);
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
echo "Now verify in browser:"
echo "1) Open https://$HOSTING_SITE.web.app/baselines"
echo "2) DevTools -> Network -> /api/baselines/fs"
echo "   - Request Headers should include Authorization: Bearer ..."
echo "   - Status should no longer be 401"
