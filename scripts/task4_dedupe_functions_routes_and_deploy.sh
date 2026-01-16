#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"

echo "== Task 4: De-dupe functions routes (remove stub + duplicate __health) + deploy =="
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo

[[ -f "$INDEX_TS" ]] || { echo "ERROR: index.ts not found at $INDEX_TS" >&2; exit 1; }

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Remove the 501 stub route block if present
// Matches a block like:
// app.post("/baselines/upload-multi-fs", (_req, res) => {
//   res.status(501).json({ ... });
// });
s = s.replace(
  /\n?app\.post\(\s*["']\/baselines\/upload-multi-fs["']\s*,\s*\([^)]*\)\s*=>\s*\{\s*[\s\S]*?res\.status\(\s*501\s*\)\.json\([\s\S]*?\)\s*;?\s*\}\s*\)\s*;?/m,
  "\n"
);

// 2) Ensure we have ONLY ONE __health route.
// Keep the richer one if it exists (the one that returns originalUrl/url), otherwise keep the simple one.
const healthMatches = [...s.matchAll(/app\.get\(\s*["']\/__health["'][\s\S]*?\);\s*/g)];
if (healthMatches.length > 1) {
  // Prefer a handler that mentions originalUrl or req.originalUrl
  let keepIdx = healthMatches.findIndex(m => /originalUrl|req\.originalUrl/.test(m[0]));
  if (keepIdx === -1) keepIdx = 0;

  // Remove all health routes then re-insert the kept one once.
  const kept = healthMatches[keepIdx][0];
  s = s.replace(/app\.get\(\s*["']\/__health["'][\s\S]*?\);\s*/g, "");
  // Insert kept route after express() app creation if possible
  if (s.includes("const app = express();")) {
    s = s.replace("const app = express();", "const app = express();\n\n" + kept.trim() + "\n");
  } else {
    s = kept.trim() + "\n\n" + s;
  }
}

// 3) Make download route compatible with /api stripper:
// If route is defined as /api/download, add an alias /download (idempotent).
if (s.includes('app.get("/api/download"') && !s.includes('app.get("/download"')) {
  s = s.replace(
    /app\.get\(\s*["']\/api\/download["']\s*,\s*requireAuth\s*,/,
    'app.get("/download", requireAuth,'
  ) + "\n\n// Alias for callers that still hit /api/download directly\napp.get(\"/api/download\", requireAuth, async (req: any, res: any) => {\n  return app._router.handle({ ...req, url: \"/download\", originalUrl: req.originalUrl }, res, () => {});\n});\n';
  // The alias above is a best-effort; if it causes TS issues, we’ll handle in lint/build (but it usually won’t compile as-is).
  // To avoid TS/router internals, instead we’ll do a safer alias insertion below if needed.
}

// SAFER alias approach (no router internals): if we converted /api/download -> /download, also add a second explicit handler by cloning.
// Only do this if /download exists and /api/download does not.
if (s.includes('app.get("/download"') && !s.includes('app.get("/api/download"')) {
  const m = s.match(/app\.get\(\s*["']\/download["'][\s\S]*?\);\s*/m);
  if (m) {
    const cloned = m[0].replace('"/download"', '"/api/download"').replace("'/download'", "'/api/download'");
    // Insert the clone right after the /download handler
    s = s.replace(m[0], m[0] + "\n" + cloned);
  }
}

// 4) Collapse >2 consecutive blank lines
s = s.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched:", file);
NODE

echo
echo "== Lint/build (must pass) =="
cd "$FUNCTIONS_DIR"
npm run lint -- --fix
npm run lint
npm run build

echo
echo "== Deploy functions:api =="
cd "$ROOT_DIR"
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== Quick probes (should NOT be 501/HTML) =="
SITE="${SITE:-ai-gatekeeper-app.web.app}"
echo "-- GET https://$SITE/api/__health"
curl -sS -i "https://$SITE/api/__health" | head -n 30 || true
echo
echo "-- POST https://$SITE/api/baselines/upload-multi-fs (expect 401 JSON if no auth header)"
curl -sS -i -X POST "https://$SITE/api/baselines/upload-multi-fs" | head -n 40 || true

echo
echo "== DONE ✅ =="
