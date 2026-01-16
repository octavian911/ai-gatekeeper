#!/usr/bin/env bash
# NOEXIT: never returns 1. Prints errors but exits 0.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

FIREBASE_JSON="$ROOT_DIR/firebase.json"
CLIENT_TS="$ROOT_DIR/frontend/client.ts"

ts() { date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task20_$(ts)"
mkdir -p "$BACKUP"

log(){ printf "\n== %s ==\n" "$*"; }
run(){ echo; echo ">> $*"; bash -lc "$*"; echo "rc=$?"; }

echo "ROOT: $ROOT_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "BACKUP: $BACKUP"

# -------------------------
# 1) Backup key files
# -------------------------
[ -f "$FIREBASE_JSON" ] && cp -a "$FIREBASE_JSON" "$BACKUP/" 2>/dev/null || true
[ -f "$CLIENT_TS" ] && cp -a "$CLIENT_TS" "$BACKUP/" 2>/dev/null || true

# -------------------------
# 2) Patch firebase.json: add rewrite for /api/api/** -> function api
# -------------------------
log "A) Patch firebase.json: route /api/api/** into Functions (fixes HTML 404 immediately)"

if [ ! -f "$FIREBASE_JSON" ]; then
  echo "WARN: firebase.json not found at $FIREBASE_JSON"
else
  node <<'NODE'
const fs = require("fs");
const f = process.env.FIREBASE_JSON;
const site = process.env.HOSTING_SITE;

let j = JSON.parse(fs.readFileSync(f, "utf8"));
let hosting = j.hosting;

if (!hosting) {
  console.log("No hosting config found. Skipping.");
  process.exit(0);
}

if (!Array.isArray(hosting)) hosting = [hosting];

// choose the site block if present, else first block
let h = hosting.find(x => x && x.site === site) || hosting[0];
if (!h) {
  console.log("No hosting block found. Skipping.");
  process.exit(0);
}

h.rewrites = h.rewrites || [];

const hasApiApi = h.rewrites.some(r => r && r.source === "/api/api/**");
if (!hasApiApi) {
  // Put it BEFORE any generic catch-alls
  h.rewrites.unshift({ source: "/api/api/**", function: "api" });
  console.log("Inserted rewrite: /api/api/** -> function api");
} else {
  console.log("Rewrite already present: /api/api/**");
}

j.hosting = Array.isArray(j.hosting) ? hosting : hosting[0];
fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n", "utf8");
console.log("Patched firebase.json OK");
NODE
fi

# -------------------------
# 3) Patch frontend/client.ts: normalize /api/api -> /api at runtime (permanent)
#    IMPORTANT: patch REAL client.ts, not a .bak file
# -------------------------
log "B) Patch frontend/client.ts: prevent /api/api at source"

if [ ! -f "$CLIENT_TS" ]; then
  echo "WARN: frontend/client.ts not found at $CLIENT_TS"
else
  node <<'NODE'
const fs = require("fs");
const f = process.env.CLIENT_TS;

let s = fs.readFileSync(f, "utf8");
const before = s;

if (!s.includes("__agkFixApiApi")) {
  const helper = `
function __agkFixApiApi(u: string) {
  // Fix double prefix created by base + path at runtime
  return u.replace(/\\/api\\/api\\//g, "/api/");
}
`;
  s = helper + "\n" + s;
}

// normalize right before fetch calls (covers runtime-built URLs)
s = s.replace(/fetch\\(\\s*([^,\\)]+)\\s*,/g, (m, p1) => {
  if (p1.includes("__agkFixApiApi")) return m;
  return `fetch(__agkFixApiApi(String(${p1})),`;
});

// normalize fetch(url) (no init)
s = s.replace(/fetch\\(\\s*([^,\\)]+)\\s*\\)/g, (m, p1) => {
  if (p1.includes("__agkFixApiApi")) return m;
  // avoid touching "fetch('...'," already handled above
  if (m.includes(",")) return m;
  return `fetch(__agkFixApiApi(String(${p1})))`;
});

if (s !== before) {
  fs.writeFileSync(f, s, "utf8");
  console.log("Patched:", f);
} else {
  console.log("No changes made (patterns not found).");
}
NODE
fi

# -------------------------
# 4) Build + deploy hosting
# -------------------------
log "C) Build frontend"
run "cd '$ROOT_DIR/frontend' && npm run build"

log "D) Deploy hosting"
run "cd '$ROOT_DIR' && firebase deploy --only hosting:$HOSTING_SITE --project '$PROJECT_ID'"

# -------------------------
# 5) Probes: verify rewrites now catch /api/api/**
# -------------------------
log "E) Probes (should NOT be HTML 404 from hosting anymore)"

run "curl -sS -i 'https://app.ai-gatekeeper.ca/api/api/__debug/verify?t=$(date +%s)' | head -n 20"
run "curl -sS -i 'https://app.ai-gatekeeper.ca/api/api/baselines/git-status?t=$(date +%s)' | head -n 30"
run "curl -sS -i 'https://app.ai-gatekeeper.ca/api/baselines/git-status?t=$(date +%s)' | head -n 30"

echo
echo "DONE. This script exits 0 by design."
exit 0
