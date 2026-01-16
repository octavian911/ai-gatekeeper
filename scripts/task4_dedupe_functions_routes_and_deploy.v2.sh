#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== Task 4 (v2): De-dupe functions routes + normalize download route =="
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo "SITE:       https://$SITE"
echo

[[ -f "$INDEX_TS" ]] || { echo "ERROR: index.ts not found at $INDEX_TS" >&2; exit 1; }

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Remove 501 stub route for baselines upload if present.
s = s.replace(
  /\n?app\.post\(\s*["']\/baselines\/upload-multi-fs["']\s*,\s*\([^)]*\)\s*=>\s*\{\s*[\s\S]*?res\.status\(\s*501\s*\)\.json\([\s\S]*?\)\s*;?\s*\}\s*\)\s*;?/m,
  "\n"
);

// 2) Keep only one /__health route (prefer richer one with originalUrl/url).
const health = [...s.matchAll(/app\.get\(\s*["']\/__health["'][\s\S]*?\);\s*/g)];
if (health.length > 1) {
  let keep = health.find(m => /originalUrl|req\.originalUrl|req\.url/.test(m[0]));
  if (!keep) keep = health[0];

  // remove all
  s = s.replace(/app\.get\(\s*["']\/__health["'][\s\S]*?\);\s*/g, "");

  // reinsert after app creation
  const kept = keep[0].trim();
  if (s.includes("const app = express();")) {
    s = s.replace("const app = express();", "const app = express();\n\n" + kept + "\n");
  } else {
    s = kept + "\n\n" + s;
  }
}

// 3) Normalize download route to /download (NOT /api/download) because /api is stripped by middleware.
// If code currently registers /api/download, rewrite it to /download.
s = s.replace(
  /app\.get\(\s*["']\/api\/download["']/g,
  'app.get("/download"'
);

// 4) Collapse >2 consecutive blank lines.
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
echo "== Quick probes =="
echo "-- GET /api/__health (expect 200 JSON)"
curl -sS -i "https://$SITE/api/__health" | head -n 40 || true
echo
echo "-- POST /api/baselines/upload-multi-fs (expect 401 JSON when no auth header, NOT HTML)"
curl -sS -i -X POST "https://$SITE/api/baselines/upload-multi-fs" | head -n 60 || true
echo
echo "-- GET /api/download without auth (expect 401 JSON, NOT HTML)"
curl -sS -i "https://$SITE/api/download?object=test" | head -n 60 || true

echo
echo "== DONE ✅ =="
