#!/usr/bin/env bash
# NOEXIT: exits 0 even if something fails.
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"
FRONTEND_DIR="$ROOT_DIR/frontend"

MAIN_TSX="$FRONTEND_DIR/src/main.tsx"
MAIN_TS="$FRONTEND_DIR/src/main.ts"
ENTRY=""

if [ -f "$MAIN_TSX" ]; then ENTRY="$MAIN_TSX"; fi
if [ -z "$ENTRY" ] && [ -f "$MAIN_TS" ]; then ENTRY="$MAIN_TS"; fi

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task22_frontend_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT: $ROOT_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "FRONTEND_DIR: $FRONTEND_DIR"
echo "ENTRY: ${ENTRY:-NOT FOUND}"
echo "BACKUP: $BACKUP"

if [ -z "$ENTRY" ]; then
  echo "WARN: Could not find frontend entry (src/main.tsx or src/main.ts). Exiting 0."
  exit 0
fi

cp -a "$ENTRY" "$BACKUP/" 2>/dev/null || true

node <<'NODE'
const fs = require("fs");
const f = process.env.ENTRY;
let s = fs.readFileSync(f, "utf8");

const MARK = "__AGK_FETCH_WRAP_ATTACH_BEARER__";
if (s.includes(MARK)) {
  console.log("Fetch wrapper already present. No change.");
  process.exit(0);
}

// Put wrapper near the top, after imports block.
// Find end of imports:
let idx = 0;
const importRe = /^\s*import .*?;\s*$/gm;
let m, last = -1;
while ((m = importRe.exec(s)) !== null) last = importRe.lastIndex;
idx = last > 0 ? last : 0;

const wrap = `

/** ${MARK}
 * Force Authorization: Bearer <Firebase ID token> for baselines calls.
 * This fixes 401 on /baselines/fs and also helps Upload + Review pages.
 */
(function () {
  try {
    const _fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      try {
        const url = typeof input === "string" ? input : (input && input.url) ? input.url : "";
        const isBaselines =
          url.includes("/baselines/") ||
          url.includes("/api/baselines/") ||
          url.includes("/api/api/baselines/");
        if (isBaselines) {
          // Dynamically load firebase/auth (works if firebase is already initialized elsewhere)
          const mod = await import("firebase/auth");
          const auth = mod.getAuth();
          const u = auth.currentUser;
          if (u) {
            const tok = await u.getIdToken();
            const h = new Headers((init && init.headers) || undefined);
            if (!h.get("Authorization")) h.set("Authorization", "Bearer " + tok);
            init = Object.assign({}, init || {}, { headers: h });
          }
        }
      } catch (e) {}
      return _fetch(input, init);
    };
  } catch (e) {}
})();
`;

s = s.slice(0, idx) + wrap + s.slice(idx);
fs.writeFileSync(f, s, "utf8");
console.log("Inserted fetch wrapper into:", f);
NODE

echo
echo "== Build frontend (best-effort) =="
( cd "$FRONTEND_DIR" && npm run build ) || true

echo
echo "== Deploy hosting (best-effort) =="
( cd "$ROOT_DIR" && firebase deploy --only hosting:"$HOSTING_SITE" --project "$PROJECT_ID" ) || true

echo
echo "DONE frontend (NOEXIT)."
exit 0
