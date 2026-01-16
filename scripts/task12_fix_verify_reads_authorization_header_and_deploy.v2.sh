#!/usr/bin/env bash
set -euo pipefail
set +H

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

cd "$ROOT_DIR"

echo "== Task 12 (v2): Fix /api/__debug/verify header parsing (no perl) =="
echo "INDEX_TS: $INDEX_TS"

cp -a "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

TMP="$(mktemp)"

# Strategy:
# - Find the verify route line: app.get(["/api/__debug/verify", "/__debug/verify"], async (req, res) => {
# - Immediately insert a robust auth extraction block
# - Skip old token-parsing lines until we hit the first "try {"
awk '
  BEGIN { in_verify=0; inserted=0; skipping_old=0; }
  {
    line=$0

    if (line ~ /app\.get\(\s*\[\s*"\/api\/__debug\/verify"\s*,\s*"\/__debug\/verify"\s*\]\s*,\s*async\s*\(req,\s*res\)\s*=>\s*\{/) {
      in_verify=1
      print line

      # Insert robust token extraction (TS-safe)
      print "    const auth = String(req.get(\"authorization\") || (req.headers && (req.headers[\"authorization\"] || (req.headers as any).authorization)) || \"\");"
      print "    const idToken = auth.startsWith(\"Bearer \") ? auth.slice(7) : \"\";"
      print "    if (!idToken) {"
      print "      return res.status(200).json({ ok: false, error: \"missing_bearer\" });"
      print "    }"

      inserted=1
      skipping_old=1
      next
    }

    # While inside verify handler, skip the old auth parsing section until first try {
    if (in_verify == 1 && skipping_old == 1) {
      if (line ~ /^[[:space:]]*try[[:space:]]*\{[[:space:]]*$/) {
        print line
        skipping_old=0
        next
      } else {
        # drop old lines
        next
      }
    }

    print line
  }
' "$INDEX_TS" > "$TMP"

mv "$TMP" "$INDEX_TS"

echo "== Sanity check: show verify route area =="
grep -nE 'app\.get\(\["/api/__debug/verify"|const auth =|const idToken =|missing_bearer|^[[:space:]]*try[[:space:]]*\{' "$INDEX_TS" | head -n 60

echo "== Lint/build/deploy functions:api =="
npm --prefix functions run lint -- --fix
npm --prefix functions run build
firebase deploy --only functions:api --project "$PROJECT_ID"

echo "== Probe (no bearer) =="
curl -sS "https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)" | head -n 40

echo "== DONE ✅ =="
