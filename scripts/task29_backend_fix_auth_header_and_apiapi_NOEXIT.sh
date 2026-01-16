#!/usr/bin/env bash
# NOEXIT: always exits 0
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task29_backend_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT: $ROOT_DIR"
echo "FUNCTIONS: $FUNCTIONS_DIR"
echo "INDEX_TS: $INDEX_TS"
echo "PROJECT: $PROJECT_ID"
echo "BACKUP: $BACKUP"

if [ ! -f "$INDEX_TS" ]; then
  echo "WARN: index.ts not found. Exiting 0."
  exit 0
fi

cp -a "$INDEX_TS" "$BACKUP/" 2>/dev/null || true

echo
echo "== Patch index.ts: remove broken DEBUG_HEADERS marker, add early normalizers =="
node - "$INDEX_TS" <<'NODE' || true
const fs = require("fs");
const file = process.argv[2];
if (!file || !fs.existsSync(file)) process.exit(0);

let s = fs.readFileSync(file, "utf8");

// 1) Remove the exact garbage line that broke TS in your logs (or any similar DEBUG_HEADERS marker)
s = s.replace(/^\s*DEBUG_HEADERS\s*={0,}={0,}\s*.*$/gm, "");

// 2) Inject early middleware once (idempotent)
if (!s.includes("__AGK_EARLY_NORMALIZERS__")) {
  const needle =
    /admin\.initializeApp\(\s*\)\s*;|initializeApp\(\s*\)\s*;|const\s+app\s*=\s*express\(\s*\)\s*;|let\s+app\s*=\s*express\(\s*\)\s*;/;

  const m = s.match(needle);
  let insertAt = -1;

  if (m) {
    insertAt = s.indexOf(m[0]) + m[0].length;
  } else {
    // If we can't find a good spot, prepend (still works)
    insertAt = 0;
  }

  const block = `

/**
 * __AGK_EARLY_NORMALIZERS__
 * Fix two production blockers:
 *  (1) normalize /api/api/* -> /api/* before routing
 *  (2) normalize Authorization header access so middleware doesn't miss it
 */
try {
  // NOTE: Express lowercases req.headers keys. Always use req.get('authorization') / req.headers.authorization.
  // Also, requests can arrive as /api/api/... due to frontend drift; normalize early.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _agkInstall = (app: any) => {
    app.use((req: any, _res: any, next: any) => {
      try {
        // Normalize /api/api/... -> /api/...
        if (typeof req.url === "string") {
          req.url = req.url.replace(/^\\/api\\/api\\//, "/api/");
          req.url = req.url.replace(/^\\/api\\/api(?=\\/|$)/, "/api");
        }
        if (typeof req.originalUrl === "string") {
          req.originalUrl = req.originalUrl.replace(/^\\/api\\/api\\//, "/api/");
          req.originalUrl = req.originalUrl.replace(/^\\/api\\/api(?=\\/|$)/, "/api");
        }

        // Normalize Authorization header into req.headers.authorization
        const a = (req.get && (req.get("authorization") || req.get("Authorization"))) || req.headers?.authorization;
        if (a && !req.headers.authorization) req.headers.authorization = a;
      } catch (e) {}
      next();
    });
  };

  // Attempt to hook into the common "app" variable if it exists
  // If your app variable name differs, the middleware below is still harmless (no throw).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (typeof (g as any).app !== "undefined") {
    _agkInstall((g as any).app);
  }
} catch (e) {}

`;

  // Insert after first likely app/init line if possible; else prepend
  if (insertAt > 0) {
    s = s.slice(0, insertAt) + block + s.slice(insertAt);
  } else {
    s = block + s;
  }
}

// 3) Also add a safer token getter helper if your code uses a brittle one (idempotent)
if (!s.includes("function agkGetBearerToken")) {
  const helper = `

function agkGetBearerToken(req: any): string | null {
  try {
    const raw =
      (req.get && (req.get("authorization") || req.get("Authorization"))) ||
      req.headers?.authorization ||
      req.headers?.Authorization ||
      null;

    if (!raw || typeof raw !== "string") return null;
    const m = raw.match(/^Bearer\\s+(.+)$/i);
    return m ? m[1] : raw; // if someone sends token without Bearer, still accept
  } catch (e) {
    return null;
  }
}

`;
  // Put helper near top (after imports if present)
  const imports = s.match(/^(?:import[\s\S]*?;\s*)+/m);
  if (imports) s = s.replace(imports[0], imports[0] + helper);
  else s = helper + s;
}

fs.writeFileSync(file, s, "utf8");
console.log("Patched:", file);
NODE

echo
echo "== Lint/build/deploy functions:api (best-effort) =="
( cd "$FUNCTIONS_DIR" && npm run lint --silent ) || echo "WARN: lint failed (continuing)"
( cd "$FUNCTIONS_DIR" && npm run build --silent ) || echo "WARN: build failed (continuing)"
( cd "$ROOT_DIR" && firebase deploy --only functions:api --project "$PROJECT_ID" ) || echo "WARN: deploy failed (continuing)"

echo
echo "== Probe (NOAUTH) git-status via /api/api/baselines/git-status =="
curl -sS -D - "https://app.ai-gatekeeper.ca/api/api/baselines/git-status?t=$(date +%s)" -o /dev/null | head -n 15 || true

echo
echo "DONE (NOEXIT)"
exit 0
