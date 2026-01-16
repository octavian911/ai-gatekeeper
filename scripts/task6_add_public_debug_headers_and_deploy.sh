#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== Task 6: Add PUBLIC debug headers endpoint + deploy =="
echo "INDEX_TS: $INDEX_TS"
echo

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

if (s.includes("AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS")) {
  console.log("ℹ️ Public debug endpoint already present.");
  process.exit(0);
}

const anchor = 'app.get("/api/__health"';
const idx = s.indexOf(anchor);
if (idx === -1) throw new Error("Could not find /api/__health anchor to insert after.");

const insert = `
// ===== AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS =====
// TEMP: public endpoint to confirm what headers arrive via Hosting rewrite.
// Remove after debugging.
app.all("/api/__debug/headers", (req, res) => {
  const auth = req.headers["authorization"] || "";
  res.json({
    ok: true,
    method: req.method,
    originalUrl: req.originalUrl,
    url: req.url,
    hasAuth: !!auth,
    authPrefix: typeof auth === "string" ? auth.slice(0, 24) : "",
    host: req.headers["host"] || "",
    origin: req.headers["origin"] || "",
  });
});
// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS =====
`;

s = s.slice(0, idx) + insert + "\n" + s.slice(idx);
fs.writeFileSync(file, s, "utf8");
console.log("✅ Inserted public debug endpoint.");
NODE

echo
echo "== Lint/build/deploy =="
cd "$FUNCTIONS_DIR"
npm run lint -- --fix
npm run lint
npm run build

cd "$ROOT_DIR"
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== Probe public debug endpoint =="
curl -s "https://$SITE/api/__debug/headers?t=$(date +%s)" | head -c 400; echo
echo "== DONE ✅ =="
