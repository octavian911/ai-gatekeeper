#!/usr/bin/env bash
# NOEXIT: always exits 0 even if something fails.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="$FUNCTIONS_DIR/src/index.ts"

echo "ROOT: $ROOT_DIR"
echo "PROJECT: $PROJECT_ID"
echo "INDEX_TS: $INDEX_TS"

if [ ! -f "$INDEX_TS" ]; then
  echo "ERROR: Cannot find $INDEX_TS"
  exit 0
fi

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/.backup_fix_baselines_v2_${TS}"
mkdir -p "$BACKUP_DIR"
cp -a "$INDEX_TS" "$BACKUP_DIR/index.ts.bak"
echo "BACKUP: $BACKUP_DIR"

node - <<'NODE'
const fs = require("fs");
const path = require("path");

const p = path.join(process.env.HOME, "ai-gatekeeper", "functions", "src", "index.ts");
let s = fs.readFileSync(p, "utf8");

// Remove previous injected block if exists (idempotent)
s = s.replace(/\/\*\s*AGK_FIX_START\s*\*\/[\s\S]*?\/\*\s*AGK_FIX_END\s*\*\/\s*/g, "");

// Find `const app = express();`
const re = /\bconst\s+app\s*=\s*express\(\)\s*;\s*/m;
const m = s.match(re);
if (!m) {
  console.log("ERROR: Could not find `const app = express();` in index.ts. Aborting patch.");
  process.exit(0);
}

const inject = `
/* AGK_FIX_START */
/**
 * AGK FIX:
 * - Normalize accidental /api/api/* requests -> /api/*
 * - Read Authorization header case-insensitively (Node lowercases headers)
 * - Add /api/baselines/whoami to confirm auth works
 */
function agkReadAuthHeader(req: any): string {
  const h =
    (req?.headers?.authorization as string) ||
    (req?.headers?.Authorization as string) ||
    (typeof req?.get === "function" ? (req.get("authorization") || req.get("Authorization")) : "") ||
    "";
  return typeof h === "string" ? h : "";
}

function agkExtractBearer(req: any): string | null {
  const raw = agkReadAuthHeader(req).trim();
  if (!raw) return null;
  const m = raw.match(/^Bearer\\s+(.+)$/i);
  return (m ? m[1] : raw).trim() || null;
}

// Normalize paths early (fix /api/api issue coming from frontend/base-url mistakes)
app.use((req: any, _res: any, next: any) => {
  try {
    const u = String(req.url || "");
    if (u.startsWith("/api/api/")) req.url = u.replace(/^\\/api\\/api\\//, "/api/");
  } catch {}
  next();
});

// Debug endpoint: proves token is being read + verified
app.get("/api/baselines/whoami", async (req: any, res: any) => {
  try {
    const tok = agkExtractBearer(req);
    if (!tok) return res.status(401).json({ ok: false, error: "unauthorized", detail: "missing_token" });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    const decoded = await admin.auth().verifyIdToken(tok);
    return res.json({ ok: true, uid: decoded?.uid || null });
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: "unauthorized", detail: String(e?.message || e) });
  }
});
/* AGK_FIX_END */
`.trim() + "\n";

// Insert right after the first match
const idx = s.search(re);
const endIdx = idx + m[0].length;
s = s.slice(0, endIdx) + "\n" + inject + "\n" + s.slice(endIdx);

fs.writeFileSync(p, s, "utf8");
console.log("Patched index.ts ✅");
NODE

echo
echo "== Lint + build (best-effort) =="
( cd "$FUNCTIONS_DIR" && npx eslint --ext .js,.ts . --config .eslintrc.deploy.cjs --fix ) || true
( cd "$FUNCTIONS_DIR" && npm run lint ) || true
( cd "$FUNCTIONS_DIR" && npm run build ) || true

echo
echo "== Deploy functions:api (best-effort) =="
firebase deploy --only functions:api --project "$PROJECT_ID" || true

echo
echo "== Probes =="
echo "-- git-status --"
curl -sS -i "https://app.ai-gatekeeper.ca/api/baselines/git-status?t=$(date +%s)" | head -n 25 || true

echo
echo "-- whoami (should be 401 without token, not 404) --"
curl -sS -i "https://app.ai-gatekeeper.ca/api/baselines/whoami?t=$(date +%s)" | head -n 25 || true

echo
echo "DONE (NOEXIT)"
exit 0
