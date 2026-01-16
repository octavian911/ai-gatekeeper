#!/usr/bin/env bash
set -euo pipefail
set +H

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

cd "$ROOT_DIR"

echo "== Task 12: Fix /api/__debug/verify to read Authorization header robustly =="
echo "INDEX_TS: $INDEX_TS"

cp -a "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

# Replace the idToken extraction block inside the verify handler.
# We look for the verify route and then replace lines that declare m/idToken derived from regex.
perl -0777 -i -pe '
s#(app\.get\(\s*\[\s*"/api/__debug/verify"\s*,\s*"/__debug/verify"\s*\]\s*,\s*async\s*\(req,\s*res\)\s*=>\s*\{\s*[\s\S]*?\n)(\s*const\s+m\s*=\s*[^;\n]+;\s*\n\s*const\s+idToken\s*=\s*[^;\n]+;\s*\n)#${1}  const auth = (req.get(\"authorization\") || (req.headers.authorization as any) || \"\") as string;\n  const idToken = auth.startsWith(\"Bearer \") ? auth.slice(7) : \"\";\n  if (!idToken) {\n    return res.status(200).json({ ok: false, error: \"missing_bearer\" });\n  }\n#mg
' "$INDEX_TS"

echo "== Sanity check: show verify handler header lines =="
grep -nE 'app\.get\(\["/api/__debug/verify"|const auth =|const idToken = auth\.startsWith\("Bearer "|missing_bearer' "$INDEX_TS" | head -n 40

echo "== Lint/build/deploy functions:api =="
npm --prefix functions run lint -- --fix
npm --prefix functions run build
firebase deploy --only functions:api --project "$PROJECT_ID"

echo "== Probe verify (no bearer) =="
curl -sS "https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)" | head -n 40

echo "== DONE ✅ =="
