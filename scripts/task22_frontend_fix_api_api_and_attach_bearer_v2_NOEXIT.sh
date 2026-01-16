#!/usr/bin/env bash
# NOEXIT: always exits 0
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"
FRONTEND_DIR="$ROOT_DIR/frontend"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task22_frontend_v2_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT: $ROOT_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "FRONTEND_DIR: $FRONTEND_DIR"
echo "BACKUP: $BACKUP"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "WARN: frontend dir not found. Exiting 0."
  exit 0
fi

# 1) Find frontend entry file (the one that bootstraps React)
ENTRY="$(grep -RIl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  -E 'createRoot\(|ReactDOM\.createRoot\(|from "react-dom/client"|from '\''react-dom/client'\''' \
  "$FRONTEND_DIR/src" 2>/dev/null | head -n 1)"

echo "ENTRY: ${ENTRY:-NOT FOUND}"
if [ -z "$ENTRY" ]; then
  echo "WARN: Could not locate React entry file under frontend/src. Exiting 0."
  exit 0
fi

cp -a "$ENTRY" "$BACKUP/" 2>/dev/null || true

# 2) Patch all occurrences of /api/api/ -> /api/ in frontend/src
echo "== Normalize /api/api -> /api in frontend/src (best-effort) =="
FILES=$(find "$FRONTEND_DIR/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null)
for f in $FILES; do
  grep -q "/api/api/" "$f" || continue
  cp -a "$f" "$BACKUP/" 2>/dev/null || true
  sed -i 's#/api/api/#/api/#g' "$f" 2>/dev/null || true
done
echo "Done: normalized /api/api -> /api"

# 3) Inject fetch wrapper into ENTRY (attach Bearer for baselines calls)
ENTRY="$ENTRY" node <<'NODE'
const fs = require("fs");
const f = process.env.ENTRY;
if (!f || !fs.existsSync(f)) {
  console.log("WARN: ENTRY missing or not found:", f);
  process.exit(0);
}

let s = fs.readFileSync(f, "utf8");
const MARK = "__AGK_FETCH_WRAP_ATTACH_BEARER__";
if (s.includes(MARK)) {
  console.log("Fetch wrapper already present. No change.");
  process.exit(0);
}

// insert after imports block
const importRe = /^\s*import .*?;\s*$/gm;
let m, last = -1;
while ((m = importRe.exec(s)) !== null) last = importRe.lastIndex;
const idx = last > 0 ? last : 0;

const wrap = `

/** ${MARK}
 * Ensure Authorization: Bearer <Firebase ID token> is attached for baselines calls.
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
console.log("Injected fetch wrapper ✅ into:", f);
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
