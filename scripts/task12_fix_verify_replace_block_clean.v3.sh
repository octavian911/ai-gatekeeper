#!/usr/bin/env bash
set -euo pipefail
set +H

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

cd "$ROOT_DIR"

echo "== Task 12 (v3): Replace verify block with ONE clean implementation =="
echo "INDEX_TS: $INDEX_TS"

cp -a "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

MARK='// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY ====='
TMP="$(mktemp)"

awk -v MARK="$MARK" '
  BEGIN { seen=0; skipping=0; replaced=0; }
  {
    line=$0

    # First marker: start replacement
    if (line == MARK && seen == 0) {
      seen=1
      skipping=1
      replaced=1

      print MARK
      print "app.get([\"/api/__debug/verify\", \"/__debug/verify\"], async (req, res) => {"
      print "  try {"
      print "    const auth = String(req.get(\"authorization\") || \"\");"
      print "    const m = auth.match(/^Bearer\\s+(.+)$/i);"
      print "    const idToken = m?.[1] || \"\";"
      print "    if (!idToken) return res.status(200).json({ ok: false, error: \"missing_bearer\" });"
      print ""
      print "    const decoded = await admin.auth().verifyIdToken(idToken);"
      print "    return res.status(200).json({"
      print "      ok: true,"
      print "      uid: decoded.uid,"
      print "      aud: decoded.aud,"
      print "      iss: decoded.iss,"
      print "      iat: decoded.iat,"
      print "      exp: decoded.exp,"
      print "      firebase: (decoded as any).firebase || null,"
      print "    });"
      print "  } catch (e) {"
      print "    const err: any = e;"
      print "    return res.status(200).json({"
      print "      ok: false,"
      print "      error: String(err?.code || err?.name || \"verify_failed\"),"
      print "      message: String(err?.message || err),"
      print "    });"
      print "  }"
      print "});"
      print MARK
      next
    }

    # Skip everything between the two markers in the existing file
    if (skipping == 1) {
      if (line == MARK) {
        skipping=0
      }
      next
    }

    print line
  }
  END {
    if (replaced == 0) {
      print "ERROR: verify markers not found; no changes made." > "/dev/stderr"
      exit 2
    }
  }
' "$INDEX_TS" > "$TMP"

mv "$TMP" "$INDEX_TS"

echo "== Sanity: verify block should be single and clean =="
grep -nE 'AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY|app\.get\(\["/api/__debug/verify"|missing_bearer|verifyIdToken' "$INDEX_TS" | head -n 80

echo "== Lint/build/deploy functions:api =="
npm --prefix functions run lint -- --fix
npm --prefix functions run build
firebase deploy --only functions:api --project "$PROJECT_ID"

echo "== Probe: headers endpoint (no auth) =="
curl -sS "https://app.ai-gatekeeper.ca/api/__debug/headers?t=$(date +%s)" | head -n 40

echo "== Probe: verify endpoint (no auth) =="
curl -sS "https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)" | head -n 40

echo "== DONE ✅ =="
