#!/usr/bin/env bash
# NOEXIT: never returns exit code 1
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
INDEX_TS="$ROOT_DIR/functions/src/index.ts"
BACKUP="$ROOT_DIR/.backup_task17_backend_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

echo "== Task17 Backend: dual-route baselines (NOEXIT) =="
echo "INDEX_TS: $INDEX_TS"
echo "BACKUP:   $BACKUP"

if [ ! -f "$INDEX_TS" ]; then
  echo "WARN: missing $INDEX_TS"
  exit 0
fi

cp -a "$INDEX_TS" "$BACKUP/index.ts" 2>/dev/null || true

# Patch common patterns:
# - app.get("/baselines/..")  -> app.get(["/api/baselines/..","/baselines/.."])
# - app.post("/baselines/..") -> same
# - app.get("/api/baselines/..") -> same
node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const f = process.argv[2];
let t = fs.readFileSync(f, "utf8");

function dualize(method, path){
  // Convert app.get("/baselines/x"...) OR app.get("/api/baselines/x"...)
  // into app.get(["/api/baselines/x","/baselines/x"]...)
  const re1 = new RegExp(`app\\.${method}\\(\\s*["']${path}([^"']*)["']\\s*,`, "g");
  t = t.replace(re1, (m, rest) => `app.${method}(["/api${path}${rest}","${path}${rest}"],`);
  const re2 = new RegExp(`app\\.${method}\\(\\s*\$begin:math:display$\\\\s\*\[\"\'\]\\\\\/api\$\{path\}\(\[\^\"\'\]\*\)\[\"\'\]\\\\s\*\,\\\\s\*\[\"\'\]\$\{path\}\(\[\^\"\'\]\*\)\[\"\'\]\\\\s\*\\$end:math:display$\\s*,`, "g");
  // normalize already-dual (ignore)
  t = t.replace(re2, (m)=>m);
}

["get","post","put","delete"].forEach(m=>{
  dualize(m, "/baselines/");
});

fs.writeFileSync(f, t);
console.log("Patched:", f);
NODE

echo "== Lint/build/deploy functions:api (best-effort) =="
npm --prefix "$ROOT_DIR/functions" run lint -- --fix 2>/dev/null || true
npm --prefix "$ROOT_DIR/functions" run build 2>/dev/null || true
firebase deploy --only functions:api --project "$PROJECT_ID" || true

echo "== Quick probe =="
curl -sS "https://app.ai-gatekeeper.ca/api/baselines/git-status?t=$(date +%s)" | head -n 5 || true
curl -sS "https://app.ai-gatekeeper.ca/baselines/git-status?t=$(date +%s)" | head -n 5 || true

echo "DONE backend (NOEXIT)"
exit 0
