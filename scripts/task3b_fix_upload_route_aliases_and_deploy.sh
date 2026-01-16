#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

[[ -d "$FUNCTIONS_DIR" ]] || die "Missing functions dir: $FUNCTIONS_DIR"
[[ -f "$INDEX_TS" ]] || die "Missing index.ts: $INDEX_TS"

note "Task 3B FIX: make upload route work behind /api stripper + add /baselines/upload-multi-fs alias"
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo "SITE:       https://$SITE"

note "0) Backup index.ts"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$INDEX_TS" "$INDEX_TS.bak.$TS"

note "1) Patch index.ts: convert app.post('/api/upload-multi-fs', requireAuth, (req,res)=>{...}) into named handler + register /upload-multi-fs + /baselines/upload-multi-fs"
node - <<'NODE'
const fs = require("fs");

const file = process.env.INDEX_TS;
if (!file) throw new Error("INDEX_TS env missing");

let s = fs.readFileSync(file, "utf8");

// Already fixed?
if (s.includes("AI_GATEKEEPER_UPLOAD_MULTI_HANDLER")) {
  console.log("✅ Upload handler already normalized; nothing to do.");
  process.exit(0);
}

// Find the route start
const routeRe = /app\.post\(\s*["']\/api\/upload-multi-fs["']\s*,\s*requireAuth\s*,\s*\(([^)]*)\)\s*=>\s*\{/m;
const m = s.match(routeRe);
if (!m) {
  throw new Error("Could not find route: app.post('/api/upload-multi-fs', requireAuth, (req,res)=>{...})");
}
const args = m[1].trim();

// Find the opening brace position after the match
const startIdx = s.indexOf(m[0]);
const braceIdx = startIdx + m[0].lastIndexOf("{"); // the "{" in the matched string

// Brace matching to find end of handler body
let i = braceIdx;
let depth = 0;
let inStr = null;
let escape = false;

for (; i < s.length; i++) {
  const ch = s[i];

  if (inStr) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === inStr) { inStr = null; continue; }
    continue;
  } else {
    if (ch === "'" || ch === '"' || ch === "`") { inStr = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) break; // this closes the handler body
    }
  }
}

if (depth !== 0) throw new Error("Brace matching failed; handler body not closed properly.");

const bodyEndBraceIdx = i; // index of closing "}"
const afterBody = s.slice(bodyEndBraceIdx + 1);

// Expect route call closure `);` or `});` shortly after
const closeRe = /^\s*\)\s*;\s*/m;        // `);`
const closeRe2 = /^\s*\)\s*\)\s*;\s*/m;  // very unlikely, ignore
const closeRe3 = /^\s*\)\s*\)\s*\)\s*;\s*/m;
const closeRouteRe = /^\s*\)\s*\)\s*;\s*/m;

const closeIdx = afterBody.search(/\)\s*;\s*/m);
if (closeIdx < 0) throw new Error("Could not find end of app.post(...) call after handler body.");

const callEndAbsolute = bodyEndBraceIdx + 1 + closeIdx + afterBody.slice(closeIdx).match(/\)\s*;\s*/m)[0].length;

// Extract handler body text including braces
const handlerBody = s.slice(braceIdx, bodyEndBraceIdx + 1);

// Replace the entire app.post(...) block with named handler + new routes
const before = s.slice(0, startIdx);
const after = s.slice(callEndAbsolute);

const replacement =
`// AI_GATEKEEPER_UPLOAD_MULTI_HANDLER
const uploadMultiFsHandler = (${args}) => ${handlerBody};

// Requests hit this function via Hosting rewrite /api/**.
// We strip "/api" earlier, so define routes WITHOUT "/api" prefix.
app.post("/upload-multi-fs", requireAuth, uploadMultiFsHandler);

// Baselines page calls this:
app.post("/baselines/upload-multi-fs", requireAuth, uploadMultiFsHandler);
`;

s = before + replacement + after;

// Lint friendliness: collapse 3+ blank lines
s = s.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Rewrote upload route into handler + registered /upload-multi-fs and /baselines/upload-multi-fs.");
NODE

note "2) Lint --fix + lint (must pass for deploy)"
npm --prefix "$FUNCTIONS_DIR" run lint -- --fix
npm --prefix "$FUNCTIONS_DIR" run lint

note "3) Deploy functions:api"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "4) Probe endpoints (expect JSON 401/4xx, NOT HTML Cannot POST)"
echo "-- POST /api/upload-multi-fs"
curl -sS -D - -X POST "https://$SITE/api/upload-multi-fs" -o /tmp/_post1.txt || true
echo "BODY:"; head -c 200 /tmp/_post1.txt || true; echo; echo

echo "-- POST /api/baselines/upload-multi-fs"
curl -sS -D - -X POST "https://$SITE/api/baselines/upload-multi-fs" -o /tmp/_post2.txt || true
echo "BODY:"; head -c 200 /tmp/_post2.txt || true; echo; echo

note "DONE ✅"
