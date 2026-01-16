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
BACKUP_DIR="$ROOT_DIR/.backup_fix_baselines_${TS}"
mkdir -p "$BACKUP_DIR"
cp -a "$INDEX_TS" "$BACKUP_DIR/index.ts.bak"
echo "BACKUP: $BACKUP_DIR"

python3 - <<'PY'
import re, pathlib, sys
p = pathlib.Path.home() / "ai-gatekeeper" / "functions" / "src" / "index.ts"
s = p.read_text(encoding="utf-8")

# 1) Remove any previous injected block (idempotent)
s = re.sub(r"/\*\s*AGK_FIX_START\s*\*/.*?/\*\s*AGK_FIX_END\s*\*/\s*", "", s, flags=re.S)

# 2) Find where express app is created
m = re.search(r"\bconst\s+app\s*=\s*express\(\)\s*;\s*", s)
if not m:
  print("ERROR: Could not find `const app = express();` in index.ts. Aborting patch.")
  sys.exit(0)

inject = r'''
/* AGK_FIX_START */
/**
 * AGK FIX:
 * - Normalize accidental /api/api/* requests -> /api/*
 * - Read Authorization header case-insensitively (Node lowercases headers)
 * - Add /api/baselines/whoami to confirm auth works
 */
function agkReadAuthHeader(req: any): string {
  // Express/Node normalize to lowercase: req.headers.authorization is the reliable one.
  const h =
    (req?.headers?.authorization as string) ||
    (req?.headers?.Authorization as string) || // defensive
    (typeof req?.get === "function" ? (req.get("authorization") || req.get("Authorization")) : "") ||
    "";
  return typeof h === "string" ? h : "";
}

function agkExtractBearer(req: any): string | null {
  const raw = agkReadAuthHeader(req).trim();
  if (!raw) return null;
  // Accept both "Bearer <token>" and raw "<token>"
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return (m ? m[1] : raw).trim() || null;
}

// Normalize paths early (fix /api/api issue coming from frontend/base-url mistakes)
app.use((req: any, _res: any, next: any) => {
  try {
    const u = String(req.url || "");
    if (u.startsWith("/api/api/")) req.url = u.replace(/^\/api\/api\//, "/api/");
  } catch {}
  next();
});

// Optional debug endpoint to prove the token is being read + verified
// Returns uid if authenticated, otherwise 401.
app.get("/api/baselines/whoami", async (req: any, res: any) => {
  try {
    const tok = agkExtractBearer(req);
    if (!tok) return res.status(401).json({ ok: false, error: "unauthorized", detail: "missing_token" });

    // Firebase Admin is commonly initialized in this file already.
    // We attempt to use global admin if present.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    const decoded = await admin.auth().verifyIdToken(tok);
    return res.json({ ok: true, uid: decoded?.uid || null });
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: "unauthorized", detail: String(e?.message || e) });
  }
});
/* AGK_FIX_END */
'''.lstrip("\n")

# 3) Insert immediately after const app = express();
insert_at = m.end()
s = s[:insert_at] + "\n" + inject + "\n" + s[insert_at:]

p.write_text(s, encoding="utf-8")
print("Patched index.ts ✅")
PY

echo
echo "== Lint + build (with fix) =="
( cd "$FUNCTIONS_DIR" && npx eslint --ext .js,.ts . --config .eslintrc.deploy.cjs --fix ) || true
( cd "$FUNCTIONS_DIR" && npm run lint ) || true
( cd "$FUNCTIONS_DIR" && npm run build ) || true

echo
echo "== Deploy functions (best-effort) =="
firebase deploy --only functions:api --project "$PROJECT_ID" || true

echo
echo "== Probes (should be JSON, not HTML) =="

echo "-- git-status (no auth expected) --"
curl -sS -i "https://app.ai-gatekeeper.ca/api/baselines/git-status?t=$(date +%s)" | head -n 25 || true

echo
echo "-- whoami (MUST be 401 without token; MUST be 200 with token) --"
curl -sS -i "https://app.ai-gatekeeper.ca/api/baselines/whoami?t=$(date +%s)" | head -n 25 || true

echo
echo "DONE (NOEXIT)"
exit 0
