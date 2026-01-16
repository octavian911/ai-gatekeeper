#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

UPLOAD_PANEL_TS="$FRONTEND_DIR/src/components/UploadPanel.tsx"
APPCHECK_FILE_TS="$FRONTEND_DIR/firebaseAppCheck.ts"
APPCHECK_FILE_TSX="$FRONTEND_DIR/firebaseAppCheck.tsx"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

note "Task 3B Fix: UploadPanel -> use /api/baselines/upload-multi-fs + attach auth headers"
echo "PROJECT_ID:   $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "UPLOAD_PANEL: $UPLOAD_PANEL_TS"

[[ -d "$ROOT_DIR" ]] || die "Missing ROOT_DIR: $ROOT_DIR"
[[ -d "$FRONTEND_DIR" ]] || die "Missing FRONTEND_DIR: $FRONTEND_DIR"
[[ -f "$UPLOAD_PANEL_TS" ]] || die "Missing UploadPanel.tsx at: $UPLOAD_PANEL_TS"

APPCHECK_FILE=""
if [[ -f "$APPCHECK_FILE_TS" ]]; then
  APPCHECK_FILE="$APPCHECK_FILE_TS"
elif [[ -f "$APPCHECK_FILE_TSX" ]]; then
  APPCHECK_FILE="$APPCHECK_FILE_TSX"
else
  die "Cannot find firebaseAppCheck.ts(x) in $FRONTEND_DIR"
fi
echo "AppCheck file: $APPCHECK_FILE"

note "1) Backup UploadPanel.tsx"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$UPLOAD_PANEL_TS" "$UPLOAD_PANEL_TS.bak.$TS"

note "2) Patch UploadPanel.tsx (endpoint + auth headers)"
export UPLOAD_PANEL_TS
node <<'NODE'
const fs = require("fs");

const file = process.env.UPLOAD_PANEL_TS;
if (!file) throw new Error("UPLOAD_PANEL_TS env missing");

let s = fs.readFileSync(file, "utf8");

// 2a) Ensure we import getAuthHeaders from firebaseAppCheck (relative path used in your prior version)
if (!s.includes("getAuthHeaders")) {
  // If there is an import from ../../firebaseAppCheck, extend it. Otherwise, add a new import.
  if (s.match(/from\s+["']\.\.\/\.\.\/firebaseAppCheck["'];/)) {
    // Add getAuthHeaders into existing named import
    s = s.replace(
      /import\s+\{\s*([^}]+)\s*\}\s+from\s+["']\.\.\/\.\.\/firebaseAppCheck["'];/,
      (m, inside) => {
        const parts = inside.split(",").map(x => x.trim()).filter(Boolean);
        if (!parts.includes("getAuthHeaders")) parts.push("getAuthHeaders");
        return `import { ${parts.join(", ")} } from "../../firebaseAppCheck";`;
      }
    );
  } else {
    // Insert after React import if possible
    if (s.includes('import React')) {
      s = s.replace(
        /import React[^;]*;\n/,
        (m) => m + 'import { getAuthHeaders } from "../../firebaseAppCheck";\n'
      );
    } else {
      s = 'import { getAuthHeaders } from "../../firebaseAppCheck";\n' + s;
    }
  }
}

// 2b) Fix endpoint: force correct route under baselines
// Replace any of these occurrences safely:
s = s.replaceAll('"/api/upload-multi-fs"', '"/api/baselines/upload-multi-fs"');
s = s.replaceAll("'\/api\/upload-multi-fs'", "'/api/baselines/upload-multi-fs'");
s = s.replaceAll('"/upload-multi-fs"', '"/api/baselines/upload-multi-fs"');
s = s.replaceAll("'/upload-multi-fs'", "'/api/baselines/upload-multi-fs'");

// 2c) Ensure fetch includes auth headers WITHOUT setting Content-Type (browser will set multipart boundary)
// We’ll patch the specific upload fetch call if it matches the common shape:
//   fetch("...", { method:"POST", body: form })
//
// If your file uses different variable names, this still usually catches it.
s = s.replace(
  /const\s+res\s*=\s*await\s+fetch\(\s*([`'"][^`'"]+[`'"])\s*,\s*\{\s*method:\s*["']POST["']\s*,\s*body:\s*form\s*\}\s*\)\s*;?/m,
  `const headers = await getAuthHeaders();\n      const res = await fetch($1, { method: "POST", body: form, headers });`
);

// If still no getAuthHeaders usage, add a minimal insertion before the first fetch to /api/baselines/upload-multi-fs
if (!s.includes("await getAuthHeaders()")) {
  s = s.replace(
    /fetch\(\s*["']\/api\/baselines\/upload-multi-fs["']\s*,\s*\{/,
    'const headers = await getAuthHeaders();\n      fetch("/api/baselines/upload-multi-fs", { headers,'
  );
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ UploadPanel.tsx patched");
NODE

note "3) Build frontend"
cd "$FRONTEND_DIR"
npm run build

note "4) Deploy hosting (push new bundle live)"
cd "$ROOT_DIR"
npx -y firebase-tools deploy --only "hosting:${HOSTING_SITE}" --project "$PROJECT_ID"

note "DONE ✅"
echo "Now test in browser:"
echo "  https://${HOSTING_SITE}.web.app/baselines"
echo
echo "DevTools -> Network:"
echo "  Request URL should be:  https://${HOSTING_SITE}.web.app/api/baselines/upload-multi-fs"
echo "  Status should NOT be 404."
echo "  Request Headers should include Authorization: Bearer ..."
