#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== Task 5: Fix missing firebase-admin import/init + deploy =="
echo "INDEX_TS: $INDEX_TS"
echo

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// 1) Ensure admin import exists
const hasAdminImport =
  /import\s+\*\s+as\s+admin\s+from\s+["']firebase-admin["']\s*;/.test(s) ||
  /const\s+admin\s*=\s*require\(\s*["']firebase-admin["']\s*\)/.test(s);

if (!hasAdminImport) {
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt, 0, `import * as admin from "firebase-admin";`);
  s = lines.join("\n");
}

// 2) Ensure admin.initializeApp() exists (guard against duplicates)
const hasInit =
  /admin\.initializeApp\(\s*\)\s*;/.test(s) ||
  /initializeApp\(\s*\)\s*;/.test(s); // in case you used firebase-admin/app earlier

if (!hasInit) {
  // Insert after imports (safe)
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
    else break;
  }
  lines.splice(insertAt + 1, 0, "", `// Firebase Admin init (required for admin.storage())`, `admin.initializeApp();`, "");
  s = lines.join("\n");
}

// Clean excessive blank lines
s = s.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Ensured firebase-admin import + initializeApp()");
NODE

echo
echo "== Lint/build (must pass) =="
cd "$FUNCTIONS_DIR"
npm run lint -- --fix
npm run lint
npm run build

echo
echo "== Deploy functions:api =="
cd "$ROOT_DIR"
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== Probe (expect JSON 401, not HTML 404) =="
curl -i "https://$SITE/api/baselines/fs" | head -n 40 || true
curl -i -X POST "https://$SITE/api/baselines/upload-multi-fs" | head -n 40 || true

echo
echo "== DONE ✅ =="
