#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== Task 6: Fix /api/__health + restore /api prefix stripper (safe, idempotent) =="
echo "INDEX_TS: $INDEX_TS"
echo

test -f "$INDEX_TS" || { echo "ERROR: $INDEX_TS not found"; exit 1; }

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// Find where express app is created
const appCreateRe = /const\s+app\s*=\s*express\(\)\s*;\s*/;
const m = s.match(appCreateRe);
if (!m) throw new Error("Could not find `const app = express();` in index.ts");

// Avoid double insert
if (s.includes("AI_GATEKEEPER_API_PREFIX_STRIPPER") && s.includes("AI_GATEKEEPER_API_HEALTH_ALIAS")) {
  console.log("ℹ️ Prefix stripper + health alias already present. No patch applied.");
  process.exit(0);
}

const insert = `
// ===== AI_GATEKEEPER_API_HEALTH_ALIAS =====
// Always respond on /api/__health even if prefix stripping is broken.
app.get("/api/__health", (_req, res) => res.status(200).json({ ok: true, via: "/api/__health" }));
// Also keep the canonical health endpoint:
app.get("/__health", (_req, res) => res.status(200).json({ ok: true, via: "/__health" }));
// ===== /AI_GATEKEEPER_API_HEALTH_ALIAS =====

// ===== AI_GATEKEEPER_API_PREFIX_STRIPPER =====
// Hosting rewrites /api/** to this function.
// Strip "/api" so we can define routes as "/baselines/..." etc.
app.use((req, _res, next) => {
  const u = req.url || "";
  if (u === "/api" || u.startsWith("/api/")) {
    req.url = u === "/api" ? "/" : u.slice(4) || "/";
  }
  next();
});
// ===== /AI_GATEKEEPER_API_PREFIX_STRIPPER =====
`;

// Insert right after app creation line
s = s.replace(appCreateRe, (x) => x + "\n" + insert + "\n");
fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched:", file);
NODE

echo
echo "== Lint/build/deploy functions:api =="
cd "$FUNCTIONS_DIR"
npm run lint -- --fix
npm run lint
npm run build

cd "$ROOT_DIR"
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== Probe =="
echo "-- GET /api/__health (should be 200 JSON)"
curl -i "https://$SITE/api/__health?t=$(date +%s)" | head -n 30

echo
echo "-- GET /api/baselines/fs (should be 401 JSON if no auth, NOT HTML 404)"
curl -i "https://$SITE/api/baselines/fs?t=$(date +%s)" | head -n 30

echo
echo "== DONE ✅ =="
