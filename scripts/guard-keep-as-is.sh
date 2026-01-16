#!/usr/bin/env bash
set -euo pipefail

# Keep-as-is policy:
# - "/" is the landing page
# - "/baselines" and "/reviews" are directly accessible
# - no forced redirect

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
FIREBASE_JSON="${FIREBASE_JSON:-$ROOT_DIR/firebase.json}"

HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"
API_FUNCTION_NAME="${API_FUNCTION_NAME:-api}"

MAIN_TSX="$FRONTEND_DIR/main.tsx"
APP_TSX="$FRONTEND_DIR/App.tsx"
DIST_DIR="$FRONTEND_DIR/dist"

die(){ echo "❌ $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

note "Guard (Keep-as-is): verify config + entrypoint + build artifacts"
echo "ROOT_DIR:      $ROOT_DIR"
echo "FRONTEND_DIR:  $FRONTEND_DIR"
echo "FIREBASE_JSON: $FIREBASE_JSON"
echo "HOSTING_SITE:  $HOSTING_SITE"
echo "API_FN:        $API_FUNCTION_NAME"

[[ -d "$ROOT_DIR" ]] || die "Missing ROOT_DIR: $ROOT_DIR"
[[ -d "$FRONTEND_DIR" ]] || die "Missing FRONTEND_DIR: $FRONTEND_DIR"
[[ -f "$FIREBASE_JSON" ]] || die "Missing firebase.json at: $FIREBASE_JSON"
[[ -f "$MAIN_TSX" ]] || die "Missing frontend/main.tsx at: $MAIN_TSX"
[[ -f "$APP_TSX" ]] || die "Missing frontend/App.tsx at: $APP_TSX"

note "1) Verify firebase.json hosting settings (site/public/rewrites)"
node - "$FIREBASE_JSON" "$HOSTING_SITE" "$API_FUNCTION_NAME" <<'NODE'
const fs = require("fs");

const p = process.argv[2];
const hostingSite = process.argv[3];
const apiFn = process.argv[4];

if (!p) throw new Error("firebase.json path arg missing");
const d = JSON.parse(fs.readFileSync(p, "utf8"));
if (!d.hosting) throw new Error("firebase.json missing top-level hosting");

const h = d.hosting;
if (h.site !== hostingSite) throw new Error(`hosting.site must be '${hostingSite}' but got '${h.site}'`);
if (h.public !== "frontend/dist") throw new Error(`hosting.public must be 'frontend/dist' but got '${h.public}'`);

const rewrites = Array.isArray(h.rewrites) ? h.rewrites : [];
const hasApi = rewrites.some(r => r && r.source === "/api/**" && r.function === apiFn);
if (!hasApi) throw new Error(`Missing rewrite: { source:'/api/**', function:'${apiFn}' }`);

const hasSpa = rewrites.some(r => r && r.source === "**" && r.destination === "/index.html");
if (!hasSpa) throw new Error("Missing SPA fallback rewrite: { source:'**', destination:'/index.html' }");

console.log("✅ firebase.json OK");
NODE

note "2) Verify entrypoint renders <App /> (not UploadPanel-only)"
if grep -q 'render(<UploadPanel' "$MAIN_TSX" 2>/dev/null; then
  die "main.tsx still renders <UploadPanel /> directly. It must render <App /> for router pages."
fi
grep -q 'import App from "./App"' "$MAIN_TSX" || die "main.tsx is missing: import App from \"./App\""
grep -q '<App' "$MAIN_TSX" || die "main.tsx does not render <App />"

echo "✅ main.tsx renders <App />"

note "3) Build frontend"
npm --prefix "$FRONTEND_DIR" run build

[[ -d "$DIST_DIR" ]] || die "Build did not create dist folder: $DIST_DIR"
[[ -f "$DIST_DIR/index.html" ]] || die "Build missing dist/index.html"

note "4) Sanity-check bundle contains Baselines/Reviews UI strings"
BUNDLE="$(ls -1 "$DIST_DIR/assets"/index-*.js 2>/dev/null | head -n 1 || true)"
[[ -n "${BUNDLE:-}" ]] || die "No JS bundle found in $DIST_DIR/assets (expected assets/index-*.js)"

grep -q "Baseline Management" "$BUNDLE" || die "Bundle missing 'Baseline Management' string (router UI may not be included)"
grep -q 'path: "/baselines"' "$BUNDLE" || die "Bundle missing '/baselines' route"
grep -q 'path: "/reviews"' "$BUNDLE" || die "Bundle missing '/reviews' route"

echo "✅ bundle contains /baselines and /reviews routes"

note "DONE ✅ Guard passed (keep-as-is)"
echo "Expected behavior:"
echo "  /          -> Landing page"
echo "  /baselines -> Baselines page (direct access)"
echo "  /reviews   -> Reviews page (direct access)"
