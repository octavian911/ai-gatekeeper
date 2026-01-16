#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="$FUNCTIONS_DIR/src/index.ts"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

note "Task 3B Backend Fix: strip /api prefix in Express so Hosting rewrite works"
echo "PROJECT_ID:   $PROJECT_ID"
echo "INDEX_TS:     $INDEX_TS"

[[ -f "$INDEX_TS" ]] || die "Missing $INDEX_TS"

TS="$(date +%Y%m%d-%H%M%S)"
note "1) Backup index.ts"
cp -v "$INDEX_TS" "$INDEX_TS.bak.$TS"

note "2) Inject /api prefix stripper middleware (only once)"
node <<'NODE'
const fs = require("fs");
const file = process.env.INDEX_TS || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let s = fs.readFileSync(file, "utf8");

if (s.includes("strip /api prefix")) {
  console.log("✅ Middleware already present (no changes).");
  process.exit(0);
}

// Find: const <name> = express();
const m = s.match(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*express\(\)\s*;\s*\n/);
if (!m) {
  console.error("Could not find `const <app> = express();` in index.ts");
  process.exit(1);
}
const appName = m[1];

const inject =
`\n// ---- AI Gatekeeper: strip /api prefix (so Firebase Hosting rewrite /api/** works) ----\n` +
`${appName}.use((req, _res, next) => {\n` +
`  // strip /api prefix\n` +
`  if (typeof req.url === "string" && req.url.startsWith("/api/")) {\n` +
`    req.url = req.url.slice(4) || "/";\n` +
`  }\n` +
`  next();\n` +
`});\n` +
`// ---- end strip /api prefix ----\n`;

s = s.replace(m[0], m[0] + inject);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Injected middleware after express() app creation.");
NODE

note "3) Deploy functions:api"
cd "$ROOT_DIR"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "DONE ✅"
echo "Now re-test from browser:"
echo "  - Upload from /baselines"
echo "  - Network should hit: /api/baselines/upload-multi-fs (POST)"
