#!/usr/bin/env bash
# NOEXIT: always exits 0 even if something fails.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task27_frontend_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT: $ROOT_DIR"
echo "FRONTEND: $FRONTEND_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "BACKUP: $BACKUP"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "WARN: frontend dir not found. Exiting 0."
  exit 0
fi

echo
echo "== 1) Find React entry file (createRoot/render) =="
ENTRY="$(grep -RIl --exclude-dir node_modules --exclude-dir dist \
  -E 'createRoot\\(|ReactDOM\\.render\\(|createApp\\(|new Vue\\(|createSSRApp\\(' \
  "$FRONTEND_DIR" 2>/dev/null | head -n 1)"

if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  echo "WARN: Could not find entry by createRoot/render. Trying common defaults..."
  for f in \
    "$FRONTEND_DIR/src/main.tsx" \
    "$FRONTEND_DIR/src/main.ts" \
    "$FRONTEND_DIR/src/index.tsx" \
    "$FRONTEND_DIR/src/index.ts" \
    "$FRONTEND_DIR/main.tsx" \
    "$FRONTEND_DIR/main.ts" \
    "$FRONTEND_DIR/index.tsx" \
    "$FRONTEND_DIR/index.ts"
  do
    if [ -f "$f" ]; then ENTRY="$f"; break; fi
  done
fi

if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  echo "WARN: Still no entry file found. Exiting 0."
  exit 0
fi

echo "ENTRY: $ENTRY"
cp -a "$ENTRY" "$BACKUP/" 2>/dev/null || true

echo
echo "== 2) Inject global fetch shim (normalize /api/api + attach Bearer) =="
node - "$ENTRY" <<'NODE' || true
const fs = require("fs");
const file = process.argv[2];
if (!file || !fs.existsSync(file)) process.exit(0);

let s = fs.readFileSync(file, "utf8");
if (s.includes("__AGK_FETCH_SHIM_V1__")) {
  console.log("Already patched:", file);
  process.exit(0);
}

const shim = `
// __AGK_FETCH_SHIM_V1__
// Global fetch shim to (1) normalize "/api/api/..." -> "/api/..."
// and (2) auto-attach Firebase Bearer token for same-origin "/api/*" requests.
(function installAgkFetchShim(){
  try {
    const _fetch = window.fetch.bind(window);

    const normalizeUrl = (u) => {
      if (typeof u !== "string") return u;
      // Only touch same-origin path requests
      if (u.startsWith("/api/api/")) return u.replace(/^\\/api\\/api\\//, "/api/");
      return u;
    };

    const getBearer = async () => {
      try {
        const mod = await import("firebase/auth");
        const auth = mod.getAuth();
        const deadline = Date.now() + 6000;
        while (!auth.currentUser && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (!auth.currentUser) return null;
        const tok = await auth.currentUser.getIdToken();
        return tok ? ("Bearer " + tok) : null;
      } catch (e) {
        return null;
      }
    };

    window.fetch = async (input, init) => {
      try {
        // Normalize URL whether string or Request
        let url = input;
        let req = null;

        if (input instanceof Request) {
          url = normalizeUrl(input.url);
          req = input;
        } else if (typeof input === "string") {
          url = normalizeUrl(input);
        }

        // Only attach auth for same-origin "/api/" calls
        const isApi =
          (typeof url === "string" && url.startsWith("/api/")) ||
          (typeof url === "string" && url.includes(location.origin + "/api/"));

        if (!isApi) return _fetch(input, init);

        // Merge headers safely
        const headers = new Headers((init && init.headers) || (req && req.headers) || {});
        if (!headers.get("Authorization")) {
          const bearer = await getBearer();
          if (bearer) headers.set("Authorization", bearer);
        }

        // Rebuild request/init
        if (req) {
          const newReq = new Request(url, req);
          return _fetch(newReq, { ...(init || {}), headers });
        }
        return _fetch(url, { ...(init || {}), headers });
      } catch (e) {
        return _fetch(input, init);
      }
    };

    console.log("[AGK] fetch shim installed");
  } catch (e) {}
})();
`;

const importBlock = s.match(/^(?:import[\\s\\S]*?;\\s*)+/m);
if (importBlock) {
  s = s.replace(importBlock[0], importBlock[0] + shim);
} else {
  s = shim + s;
}

fs.writeFileSync(file, s, "utf8");
console.log("Patched:", file);
NODE

echo
echo "== 3) Build frontend (best-effort) =="
( cd "$FRONTEND_DIR" && npm run build ) || echo "WARN: build failed"

echo
echo "== 4) Deploy hosting (best-effort) =="
( cd "$ROOT_DIR" && firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID" ) || echo "WARN: deploy failed"

echo
echo "== 5) Verify LIVE JS no longer contains 'api/api' =="
ASSET_PATH="$(curl -sS https://app.ai-gatekeeper.ca/baselines \
  | tr '"' '\n' \
  | grep -E '^/assets/index-.*\.js$' \
  | head -n 1)"
echo "Live asset: $ASSET_PATH"
if [ -n "$ASSET_PATH" ]; then
  HIT="$(curl -sS "https://app.ai-gatekeeper.ca${ASSET_PATH}" | grep -n "api/api" | head -n 10)"
  if [ -n "$HIT" ]; then
    echo "❌ STILL FOUND api/api in live JS:"
    echo "$HIT"
  else
    echo "✅ No api/api found in live JS."
  fi
else
  echo "WARN: could not detect live JS asset."
fi

echo
echo "DONE (NOEXIT)"
exit 0
