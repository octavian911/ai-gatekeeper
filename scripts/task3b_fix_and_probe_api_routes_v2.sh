#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

[[ -f "$INDEX_TS" ]] || die "Missing: $INDEX_TS"

note "Task 3B: Fix /api prefix routing + add /__health + deploy + probe"
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo "SITE:       $SITE"

note "1) Backup index.ts"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$INDEX_TS" "$INDEX_TS.bak.$TS"

note "2) Patch index.ts (idempotent): /api stripper + /__health"
node <<'NODE' "$INDEX_TS"
const fs = require("fs");

const file = process.argv[2];
if (!file) throw new Error("Missing index.ts path argument");

let s = fs.readFileSync(file, "utf8");

const MARKER = "AI-GATEKEEPER_API_PREFIX_STRIPPER";
const HEALTH_MARKER = "AI-GATEKEEPER_HEALTH_ENDPOINT";

const hasStripper = s.includes(MARKER);
const hasHealth = s.includes(HEALTH_MARKER);

// Find app creation: const app = express();
const m = s.match(/\bconst\s+app\s*=\s*express\(\)\s*;\s*/);
if (!m) throw new Error("Could not find `const app = express();` in index.ts");

if (!hasStripper) {
  const inject = `
/** ${MARKER}
 * Normalize URLs when Firebase Hosting rewrites "/api/**" to the function.
 * If requests reach Express as "/api/...", strip that prefix so routes can be written as "/baselines/..."
 */
app.use((req, _res, next) => {
  const u = req.url || "";
  if (u === "/api" || u === "/api/") req.url = "/";
  else if (u.startsWith("/api/")) req.url = u.slice(4) || "/";
  next();
});
/** end ${MARKER} */
`;
  s = s.replace(m[0], m[0] + inject);
}

if (!hasHealth) {
  const health = `
/** ${HEALTH_MARKER}
 * Probe endpoint (via Hosting): GET /api/__health
 */
app.get("/__health", (req, res) => {
  res.status(200).json({
    ok: true,
    method: req.method,
    originalUrl: req.originalUrl,
    url: req.url,
  });
});
/** end ${HEALTH_MARKER} */
`;

  const afterStripper = new RegExp(`/\\*\\* ${MARKER}[\\s\\S]*?end ${MARKER} \\*/\\s*`, "m");
  if (afterStripper.test(s)) s = s.replace(afterStripper, mm => mm + health);
  else s = s.replace(m[0], m[0] + health);
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched index.ts (stripper + health ensured).");
NODE

note "3) Deploy functions:api"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "4) Probe endpoints through Hosting rewrite (/api/**)"
base="https://$SITE"

probe() {
  local method="$1"
  local path="$2"
  echo "-- $method $path"
  curl -sS -D- -H "Cache-Control: no-cache" -X "$method" "$base$path" -o /tmp/_body.txt || true
  echo "BODY (first 200 chars):"
  head -c 200 /tmp/_body.txt; echo
  echo
}

echo "Base: $base"
echo

probe "GET"  "/api/__health"
probe "GET"  "/api/baselines"
probe "GET"  "/api/baselines/fs"
probe "GET"  "/api/baselines/git-status"
probe "POST" "/api/baselines/upload"
probe "POST" "/api/baselines/upload-multi"
probe "POST" "/api/baselines/upload-multi-fs"
probe "POST" "/api/baselines/import-zip"
probe "POST" "/api/baselines/import-zip-fs"
probe "GET"  "/api/baselines/export.zip"
probe "GET"  "/api/baselines/export-zip-fs"

note "DONE ✅"
echo "Key check: /api/__health must return JSON 200."
echo "If /api/__health is 200 but baselines are 404 => backend doesn't expose those routes (we'll map to the real ones)."
