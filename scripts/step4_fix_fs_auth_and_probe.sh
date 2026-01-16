#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Patching $FILE"

node <<'NODE'
const fs = require("fs");
const path = require("path");

const file = path.join(process.env.HOME, "ai-gatekeeper", "functions", "src", "index.ts");
let s = fs.readFileSync(file, "utf8");

function ensureOnce(marker, block) {
  if (s.includes(marker)) return;
  // Insert right after `const app = express();` if present, else near top.
  const anchor = "const app = express();";
  const idx = s.indexOf(anchor);
  if (idx !== -1) {
    const insertAt = idx + anchor.length;
    s = s.slice(0, insertAt) + "\n\n" + block + "\n" + s.slice(insertAt);
    return;
  }
  s = block + "\n" + s;
}

// Make sure we have admin import + initializeApp already; we will use admin.auth().verifyIdToken.
// Create helpers + requireAuthV2 + fs_debug endpoint.
const BLOCK = `
/** __AGK_AUTH_V2__
 * Use ONE canonical way to read/verify ID tokens.
 * (whoami already works — match that exact behavior)
 */
function agkTokenMeta(tok) {
  const t = String(tok || "").trim();
  const dots = (t.match(/\\./g) || []).length;
  const len = t.length;
  const head = t.slice(0, 12);
  const tail = t.slice(Math.max(0, t.length - 12));
  return { len, dots, head, tail };
}

function agkReadAuthHeaderV2(req) {
  const h =
    (req && req.headers && req.headers.authorization) ||
    (req && req.headers && req.headers.Authorization) ||
    (typeof req?.get === "function" ? (req.get("authorization") || req.get("Authorization")) : "") ||
    "";
  return typeof h === "string" ? h : "";
}

function agkExtractBearerV2(req) {
  const raw = agkReadAuthHeaderV2(req).trim();
  if (!raw) return null;
  const m = raw.match(/^Bearer\\s+(.+)$/i);
  return (m ? m[1] : raw).trim() || null;
}

async function requireAuthV2(req, res, next) {
  const tok = agkExtractBearerV2(req);
  if (!tok) {
    return res.status(401).json({ ok: false, error: "unauthorized", detail: "missing_token", meta: agkTokenMeta(tok) });
  }
  try {
    // Use SAME verifier as whoami does.
    const decoded = await admin.auth().verifyIdToken(tok);
    req.uid = decoded.uid;
    return next();
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      detail: String(e && e.message ? e.message : e),
      meta: agkTokenMeta(tok),
    });
  }
}

// Debug: shows what FS auth middleware sees (meta only — not the full token)
app.get("/api/baselines/fs_debug", async (req, res) => {
  const tok = agkExtractBearerV2(req);
  try {
    const decoded = tok ? await admin.auth().verifyIdToken(tok) : null;
    return res.json({ ok: true, meta: agkTokenMeta(tok), uid: decoded ? decoded.uid : null });
  } catch (e) {
    return res.status(401).json({ ok: false, meta: agkTokenMeta(tok), detail: String(e && e.message ? e.message : e) });
  }
});
`;

ensureOnce("__AGK_AUTH_V2__", BLOCK);

// Switch ONLY the baselines fs route(s) to requireAuthV2.
// We match the route line and replace the middleware token.
s = s.replace(
  /app\.get\(\s*\[\s*["']\/api\/baselines\/fs["']\s*,\s*["']\/baselines\/fs["']\s*\]\s*,\s*requireAuth\s*,/g,
  'app.get(["/api/baselines/fs", "/baselines/fs"], requireAuthV2,'
);
s = s.replace(
  /app\.get\(\s*["']\/baselines\/fs["']\s*,\s*requireAuth\s*,/g,
  'app.get("/baselines/fs", requireAuthV2,'
);
s = s.replace(
  /app\.get\(\s*["']\/api\/baselines\/fs["']\s*,\s*requireAuth\s*,/g,
  'app.get("/api/baselines/fs", requireAuthV2,'
);

fs.writeFileSync(file, s, "utf8");
console.log("Patched:", file);
NODE

echo "==> Lint + Build + Deploy functions:api"
cd "$ROOT/functions" || exit 1
npm run lint -- --fix
npm run build
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo
echo "==> Probe with a FRESH token"
echo "Paste token (single line) then press Enter:"
read -r JWT

if [ -z "${JWT}" ]; then
  echo "ERROR: empty token"
  exit 2
fi

CLOUDRUN_BASE="https://api-cbkg2trx7q-uc.a.run.app"
APP_BASE="https://app.ai-gatekeeper.ca"

echo
echo "==> fs_debug (APP)"
curl -sS -i -H "Authorization: Bearer ${JWT}" "${APP_BASE}/api/baselines/fs_debug?t=$(date +%s)" | head -n 80
echo
echo "==> fs_debug (CLOUDRUN)"
curl -sS -i -H "Authorization: Bearer ${JWT}" "${CLOUDRUN_BASE}/api/baselines/fs_debug?t=$(date +%s)" | head -n 80

echo
echo "==> fs (APP)"
curl -sS -i -H "Authorization: Bearer ${JWT}" "${APP_BASE}/api/baselines/fs?t=$(date +%s)" | head -n 120
echo
echo "==> fs (CLOUDRUN)"
curl -sS -i -H "Authorization: Bearer ${JWT}" "${CLOUDRUN_BASE}/api/baselines/fs?t=$(date +%s)" | head -n 120

echo "DONE"
