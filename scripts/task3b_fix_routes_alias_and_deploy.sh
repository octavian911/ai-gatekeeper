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

note "Task 3B: Make backend accept /baselines/* (behind Hosting /api rewrite) + deploy"
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo "SITE:       https://$SITE"

note "0) Quick probe: /api/__health (may be 404 until routes are fixed)"
curl -sS -D - "https://$SITE/api/__health" -o /tmp/_health_body.txt || true
echo "BODY:"
head -c 200 /tmp/_health_body.txt || true
echo; echo

note "1) Show what upload-ish routes exist in functions/src (grep)"
echo "--- searching for 'upload' / 'baselines' strings in functions/src ---"
grep -RIn --exclude-dir=node_modules --exclude=*.bak -E "upload-multi-fs|upload|baselines|__health" "$FUNCTIONS_DIR/src" || true
echo

note "2) Backup index.ts"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$INDEX_TS" "$INDEX_TS.bak.$TS"

note "3) Patch index.ts as TEXT: add route aliases (idempotent)"
node - <<'NODE'
const fs = require("fs");

const file = process.env.INDEX_TS;
if (!file) throw new Error("INDEX_TS env missing");

let s = fs.readFileSync(file, "utf8");

// Helper: ensure we don't double-inject blocks
function ensureOnce(marker, block) {
  if (s.includes(marker)) return false;
  // inject near top-level after `const app = express()` if possible
  const re = /const\s+app\s*=\s*express\(\)\s*;?/;
  const m = s.match(re);
  if (m) {
    const idx = s.indexOf(m[0]) + m[0].length;
    s = s.slice(0, idx) + "\n\n" + block + "\n" + s.slice(idx);
    return true;
  }
  // fallback: append
  s += "\n\n" + block + "\n";
  return true;
}

// 1) Ensure /api prefix stripper exists (if you already injected earlier, keep it)
if (!s.includes("AI_GATEKEEPER_API_PREFIX_STRIPPER")) {
  const block = `// AI_GATEKEEPER_API_PREFIX_STRIPPER
// Firebase Hosting rewrite sends /api/** to this function; normalize so app routes can be defined without /api prefix.
app.use((req, _res, next) => {
  if (req.url === "/api" || req.url.startsWith("/api/")) {
    req.url = req.url.replace(/^\\/api(\\/|$)/, "/");
  }
  next();
});`;
  ensureOnce("AI_GATEKEEPER_API_PREFIX_STRIPPER", block);
}

// 2) Ensure /__health exists
if (!s.includes("AI_GATEKEEPER_HEALTH_ENDPOINT")) {
  const block = `// AI_GATEKEEPER_HEALTH_ENDPOINT
app.get("/__health", (_req, res) => res.status(200).json({ ok: true }));`;
  ensureOnce("AI_GATEKEEPER_HEALTH_ENDPOINT", block);
}

// 3) Add baselines upload alias if missing.
// Strategy:
// - If index.ts already has /baselines/upload-multi-fs => do nothing
// - Else if it has app.post("/upload-multi-fs", SOME_HANDLER) => alias baselines path to SAME_HANDLER
if (!s.includes('"/baselines/upload-multi-fs"') && !s.includes("'/baselines/upload-multi-fs'")) {
  const re = /app\.post\(\s*["']\/upload-multi-fs["']\s*,\s*([A-Za-z0-9_$.]+)\s*\)/;
  const m = s.match(re);
  if (m && m[1]) {
    const handler = m[1];
    const aliasLine = `\n// AI_GATEKEEPER_BASELINES_UPLOAD_ALIAS\napp.post("/baselines/upload-multi-fs", ${handler});\n`;
    // insert right after the original route line
    const insertAt = s.indexOf(m[0]) + m[0].length;
    s = s.slice(0, insertAt) + aliasLine + s.slice(insertAt);
  } else {
    // If we can't safely alias, at least provide a JSON 404-style hint instead of HTML "Cannot POST"
    if (!s.includes("AI_GATEKEEPER_BASELINES_UPLOAD_FALLBACK")) {
      const fallback = `// AI_GATEKEEPER_BASELINES_UPLOAD_FALLBACK
app.post("/baselines/upload-multi-fs", (_req, res) => {
  res.status(501).json({ ok: false, error: "baselines upload route not wired: expected a handler for /upload-multi-fs or implement /baselines/upload-multi-fs" });
});`;
      ensureOnce("AI_GATEKEEPER_BASELINES_UPLOAD_FALLBACK", fallback);
    }
  }
}

// 4) Collapse 3+ blank lines to max 2 to satisfy eslint no-multiple-empty-lines
s = s.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ index.ts patched (stripper + health + baselines upload alias/fallback).");
NODE

note "4) Lint --fix + lint"
npm --prefix "$FUNCTIONS_DIR" run lint -- --fix
npm --prefix "$FUNCTIONS_DIR" run lint

note "5) Deploy functions:api"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "6) Probe endpoints again"
echo "-- GET /api/__health"
curl -sS -D - "https://$SITE/api/__health" -o /tmp/_health_body2.txt || true
echo "BODY:"; head -c 200 /tmp/_health_body2.txt || true; echo; echo

echo "-- POST /api/baselines/upload-multi-fs (empty form, just to see if route exists; expect 4xx/5xx JSON, NOT HTML 404)"
curl -sS -D - -X POST "https://$SITE/api/baselines/upload-multi-fs" -o /tmp/_post_body.txt || true
echo "BODY:"; head -c 200 /tmp/_post_body.txt || true; echo; echo

note "DONE ✅"
