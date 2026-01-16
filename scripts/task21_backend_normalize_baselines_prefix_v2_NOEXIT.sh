#!/usr/bin/env bash
# NOEXIT: always exits 0
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
INDEX_TS="$ROOT_DIR/functions/src/index.ts"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task21_backend_v2_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT:    $ROOT_DIR"
echo "PROJECT: $PROJECT_ID"
echo "INDEX_TS:$INDEX_TS"
echo "BACKUP:  $BACKUP"

if [ ! -f "$INDEX_TS" ]; then
  echo "WARN: functions/src/index.ts not found. Exiting 0."
  exit 0
fi

cp -a "$INDEX_TS" "$BACKUP/" 2>/dev/null || true

# IMPORTANT: pass INDEX_TS to node correctly
INDEX_TS="$INDEX_TS" node <<'NODE'
const fs = require("fs");

const f = process.env.INDEX_TS;
if (!f || !fs.existsSync(f)) {
  console.log("WARN: INDEX_TS env missing or file not found:", f);
  process.exit(0);
}

let s = fs.readFileSync(f, "utf8");

const MARK = "__AGK_BASELINES_PREFIX_NORMALIZER__";
if (s.includes(MARK)) {
  console.log("Normalizer already present. No change.");
  process.exit(0);
}

// Insert right after `const app = express();`
const re = /const\s+app\s*=\s*express\(\)\s*;\s*\n/;
const m = s.match(re);
if (!m) {
  console.log("WARN: Could not find `const app = express();` anchor. No change.");
  process.exit(0);
}

const insert = `
/** ${MARK}
 * Normalize Hosting rewrite prefixes so route matching works:
 *  - /api/api/baselines/* -> /baselines/*
 *  - /api/baselines/*     -> /baselines/*
 */
app.use((req, _res, next) => {
  try {
    const u = String(req.url || "");
    if (u.startsWith("/api/api/baselines/")) req.url = u.replace(/^\\/api\\/api\\/baselines\\//, "/baselines/");
    else if (u.startsWith("/api/baselines/")) req.url = u.replace(/^\\/api\\/baselines\\//, "/baselines/");
  } catch (e) {}
  next();
});
`;

s = s.replace(re, m[0] + insert);
fs.writeFileSync(f, s, "utf8");
console.log("Inserted baselines prefix normalizer ✅");
NODE

echo
echo "== Lint/build/deploy functions (best-effort) =="
( cd "$ROOT_DIR/functions" && npm run lint -- --fix ) || true
( cd "$ROOT_DIR/functions" && npm run build ) || true
( cd "$ROOT_DIR" && firebase deploy --only functions:api --project "$PROJECT_ID" ) || true

echo
echo "== Probe (should NOT be HTML 404 if routes exist) =="
curl -sS -i "https://app.ai-gatekeeper.ca/api/api/baselines/git-status?t=$(date +%s)" | head -n 25 || true
curl -sS -i "https://app.ai-gatekeeper.ca/api/api/baselines/fs?t=$(date +%s)" | head -n 25 || true

echo "DONE backend (NOEXIT)."
exit 0
