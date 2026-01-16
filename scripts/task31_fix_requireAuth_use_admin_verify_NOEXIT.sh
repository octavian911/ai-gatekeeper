#!/usr/bin/env bash
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="$FUNCTIONS_DIR/src/index.ts"

echo "ROOT: $ROOT_DIR"
echo "FUNCTIONS: $FUNCTIONS_DIR"
echo "INDEX_TS: $INDEX_TS"

if [ ! -f "$INDEX_TS" ]; then
  echo "ERROR: missing $INDEX_TS"
  exit 0
fi

BK="$ROOT_DIR/.backup_task31_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BK"
cp -f "$INDEX_TS" "$BK/index.ts"
echo "BACKUP: $BK"

# Use node (python3 isn't available) to replace the requireAuth function block safely.
node <<'NODE'
const fs = require("fs");
const p = process.env.INDEX_TS;
let s = fs.readFileSync(p, "utf8");

const re = /async function requireAuth\s*\([\s\S]*?\n}\n/;
const replacement = `async function requireAuth(req: AuthedReq, res: express.Response, next: express.NextFunction) {
  try {
    const raw =
      (req.headers?.authorization as any) ||
      (typeof (req as any).get === "function" ? ((req as any).get("authorization") || (req as any).get("Authorization")) : "") ||
      "";
    const h = String(raw || "").trim();
    const m = h.match(/^Bearer\\s+(.+)$/i);
    const tok = (m ? m[1] : h).trim();
    if (!tok) return res.status(401).json({ ok: false, error: "unauthorized", detail: "missing_token" });

    const decoded = await admin.auth().verifyIdToken(tok);
    req.uid = decoded.uid;
    return next();
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: "unauthorized", detail: String(e?.message || e) });
  }
}
`;

if (!re.test(s)) {
  console.log("ERROR: could not find requireAuth() block to replace");
  process.exit(0);
}

s = s.replace(re, replacement + "\n");
fs.writeFileSync(p, s);
console.log("Patched requireAuth() successfully.");
NODE

# Lint fix + build + deploy
echo "== Lint fix =="
npm --prefix "$FUNCTIONS_DIR" run lint -- --fix || true
echo "== Lint =="
npm --prefix "$FUNCTIONS_DIR" run lint || true
echo "== Build =="
npm --prefix "$FUNCTIONS_DIR" run build || true

echo "== Deploy functions:api =="
firebase deploy --only functions:api --project ai-gatekeeper-ea724 || true

echo "== DONE =="
