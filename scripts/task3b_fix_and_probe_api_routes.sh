#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

[[ -f "$INDEX_TS" ]] || die "Missing $INDEX_TS"

note "Task 3B: Make /api rewrite compatible + probe real API routes"
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"

note "1) Backup index.ts"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$INDEX_TS" "$INDEX_TS.bak.$TS"

note "2) Inject robust /api prefix stripper + /__health (idempotent)"
node <<'NODE'
const fs = require("fs");

const file = process.env.INDEX_TS;
if (!file) throw new Error("INDEX_TS env missing");

let s = fs.readFileSync(file, "utf8");

const MARKER = "AI-GATEKEEPER_API_PREFIX_STRIPPER";
const HEALTH_MARKER = "AI-GATEKEEPER_HEALTH_ENDPOINT";

const hasMarker = s.includes(MARKER);
const hasHealth = s.includes(HEALTH_MARKER);

// find "const app = express();" line
const m = s.match(/\bconst\s+app\s*=\s*express\(\)\s*;\s*/);
if (!m) {
  throw new Error("Could not find `const app = express();` in functions/src/index.ts");
}

if (!hasMarker) {
  const inject = `
/** ${MARKER}
 * Firebase Hosting rewrite "/api/**" -> function "api" may forward the URL with "/api" prefix intact.
 * Normalize req.url so routes can be implemented without the "/api" prefix.
 * (originalUrl stays the same; that's fine for routing.)
 */
app.use((req, _res, next) => {
  const u = req.url || "";
  if (u === "/api" || u === "/api/") {
    req.url = "/";
  } else if (u.startsWith("/api/")) {
    req.url = u.slice(4) || "/";
  }
  next();
});
/** end ${MARKER} */
`;

  s = s.replace(m[0], m[0] + inject);
}

if (!hasHealth) {
  // Put health after the prefix stripper (which we just injected right after app creation)
  // If stripper already existed, still safe to add health after app creation block.
  const health = `
/** ${HEALTH_MARKER}
 * Always-on probe endpoint.
 * Call via Hosting: GET /api/__health
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

  // Insert after prefix stripper if present, else after app creation.
  const afterStripper = new RegExp(`/\\*\\* ${MARKER}[\\s\\S]*?end ${MARKER} \\*/\\s*`, "m");
  if (afterStripper.test(s)) {
    s = s.replace(afterStripper, (mm) => mm + health);
  } else {
    s = s.replace(m[0], m[0] + health);
  }
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ index.ts patched (stripper + health present).");
NODE
export INDEX_TS="$INDEX_TS"

note "3) Deploy functions:api"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "4) Probe endpoints via Hosting (/api/...)"
SITE="${SITE:-ai-gatekeeper-app.web.app}"
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

echo "Site: $base"
echo

# Health should ALWAYS be JSON 200 if routing is correct
probe "GET" "/api/__health"

# Common baselines surfaces (some might require auth; 401/403 is OK)
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
echo "If /api/__health is JSON 200, Hosting->Function->Express routing is correct."
echo "If baselines endpoints still 404, the backend simply doesn't expose those paths (we'll map to the real ones next)."
