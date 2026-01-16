#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

[[ -f "$INDEX_TS" ]] || die "Missing index.ts: $INDEX_TS"

note "Fix TS7006: ensure uploadMultiFsHandler params are typed (req:any, res:any)"
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"

note "1) Backup index.ts"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$INDEX_TS" "$INDEX_TS.bak.$TS"

note "2) Patch uploadMultiFsHandler signature to avoid implicit-any"
node - <<'NODE'
const fs = require("fs");
const file = process.env.INDEX_TS;
if (!file) throw new Error("INDEX_TS env missing");

let s = fs.readFileSync(file, "utf8");

// Only touch the handler we injected
if (!s.includes("AI_GATEKEEPER_UPLOAD_MULTI_HANDLER") || !s.includes("const uploadMultiFsHandler")) {
  throw new Error("uploadMultiFsHandler marker not found. Did the previous script run?");
}

// Normalize a few possible forms:
// (req: any, res) =>
// (req, res) =>
// (req: any, res: any) =>
s = s.replace(
  /const\s+uploadMultiFsHandler\s*=\s*\(\s*req\s*:\s*any\s*,\s*res\s*\)\s*=>/g,
  "const uploadMultiFsHandler = (req: any, res: any) =>"
);
s = s.replace(
  /const\s+uploadMultiFsHandler\s*=\s*\(\s*req\s*,\s*res\s*\)\s*=>/g,
  "const uploadMultiFsHandler = (req: any, res: any) =>"
);
s = s.replace(
  /const\s+uploadMultiFsHandler\s*=\s*\(\s*req\s*:\s*any\s*,\s*res\s*:\s*any\s*\)\s*=>/g,
  "const uploadMultiFsHandler = (req: any, res: any) =>"
);

// Also handle if req is untyped but res typed etc (rare)
s = s.replace(
  /const\s+uploadMultiFsHandler\s*=\s*\(\s*req\s*,\s*res\s*:\s*any\s*\)\s*=>/g,
  "const uploadMultiFsHandler = (req: any, res: any) =>"
);
s = s.replace(
  /const\s+uploadMultiFsHandler\s*=\s*\(\s*req\s*:\s*any\s*,\s*res\s*\)\s*=>/g,
  "const uploadMultiFsHandler = (req: any, res: any) =>"
);

// Keep file tidy
s = s.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ uploadMultiFsHandler signature normalized to (req:any, res:any).");
NODE

note "3) Lint --fix + lint + build (so deploy won't fail)"
npm --prefix "$FUNCTIONS_DIR" run lint -- --fix
npm --prefix "$FUNCTIONS_DIR" run lint
npm --prefix "$FUNCTIONS_DIR" run build

note "4) Deploy functions:api"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "5) Probe endpoints (expect JSON 401/4xx, NOT HTML Cannot POST)"
echo "-- POST /api/upload-multi-fs"
curl -sS -D - -X POST "https://$SITE/api/upload-multi-fs" -o /tmp/_p1.txt || true
echo "BODY:"; head -c 200 /tmp/_p1.txt || true; echo; echo

echo "-- POST /api/baselines/upload-multi-fs"
curl -sS -D - -X POST "https://$SITE/api/baselines/upload-multi-fs" -o /tmp/_p2.txt || true
echo "BODY:"; head -c 200 /tmp/_p2.txt || true; echo; echo

note "DONE ✅"
