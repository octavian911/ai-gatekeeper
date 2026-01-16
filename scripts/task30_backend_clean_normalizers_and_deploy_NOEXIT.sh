#!/usr/bin/env bash
# NOEXIT: always exits 0
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task30_backend_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT: $ROOT_DIR"
echo "FUNCTIONS: $FUNCTIONS_DIR"
echo "INDEX_TS: $INDEX_TS"
echo "PROJECT: $PROJECT_ID"
echo "BACKUP: $BACKUP"

if [ ! -f "$INDEX_TS" ]; then
  echo "WARN: index.ts not found. Exiting 0."
  exit 0
fi

cp -a "$INDEX_TS" "$BACKUP/" 2>/dev/null || true

echo
echo "== Patch index.ts (remove previous injected blocks; insert clean middleware after app = express()) =="
node - "$INDEX_TS" <<'NODE' || true
const fs = require("fs");
const file = process.argv[2];
if (!file || !fs.existsSync(file)) process.exit(0);

let s = fs.readFileSync(file, "utf8");

// 1) Remove any prior injected blocks we added earlier (idempotent)
s = s.replace(/\/\*\*\s*__AGK_EARLY_NORMALIZERS__[\s\S]*?\*\/\s*try\s*\{[\s\S]*?\}\s*catch\s*\(e\)\s*\{\}\s*/g, "");
s = s.replace(/function\s+agkGetBearerToken\s*\([\s\S]*?\n\}\n\n/g, "");

// Also remove the exact broken DEBUG_HEADERS garbage if it ever reappears
s = s.replace(/^\s*DEBUG_HEADERS\s*={0,}={0,}\s*.*$/gm, "");

// 2) Insert a minimal, lint-friendly middleware after `const app = express()` (or let)
const marker = "__AGK_NORMALIZE_APIAPI__";
if (!s.includes(marker)) {
  const re = /(const|let)\s+app\s*=\s*express\s*\(\s*\)\s*;?/;
  const m = s.match(re);
  if (m) {
    const idx = s.indexOf(m[0]) + m[0].length;
    const inject =
`\n\n// ${marker}\napp.use((req, _res, next) => {\n  try {\n    if (typeof req.url === "string") {\n      req.url = req.url.replace(/^\\/api\\/api\\//, "/api/");\n      req.url = req.url.replace(/^\\/api\\/api(?=\\/|$)/, "/api");\n    }\n    if (typeof req.originalUrl === "string") {\n      req.originalUrl = req.originalUrl.replace(/^\\/api\\/api\\//, "/api/");\n      req.originalUrl = req.originalUrl.replace(/^\\/api\\/api(?=\\/|$)/, "/api");\n    }\n\n    const raw = (req.get && (req.get("authorization") || req.get("Authorization"))) || req.headers?.authorization;\n    if (raw && !req.headers.authorization) req.headers.authorization = raw;\n  } catch (e) {\n    // ignore\n  }\n  next();\n});\n`;
    s = s.slice(0, idx) + inject + s.slice(idx);
  }
}

// 3) Enforce max 2 blank lines (so eslint no-multiple-empty-lines passes)
s = s.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("Patched:", file);
NODE

echo
echo "== Format + fix lint (eslint --fix), then lint + build =="
( cd "$FUNCTIONS_DIR" && npx eslint --ext .js,.ts . --config .eslintrc.deploy.cjs --fix ) || echo "WARN: eslint --fix failed (continuing)"
( cd "$FUNCTIONS_DIR" && npm run lint ) || echo "WARN: npm run lint failed (continuing)"
( cd "$FUNCTIONS_DIR" && npm run build ) || echo "WARN: npm run build failed (continuing)"

echo
echo "== Deploy functions:api (best-effort) =="
( cd "$ROOT_DIR" && firebase deploy --only functions:api --project "$PROJECT_ID" ) || echo "WARN: deploy failed (continuing)"

echo
echo "== Probe git-status and fs (no auth) =="
curl -sS -D - "https://app.ai-gatekeeper.ca/api/api/baselines/git-status?t=$(date +%s)" -o /dev/null | head -n 15 || true
curl -sS -D - "https://app.ai-gatekeeper.ca/api/api/baselines/fs?t=$(date +%s)" -o /dev/null | head -n 15 || true

echo
echo "DONE (NOEXIT)"
exit 0
