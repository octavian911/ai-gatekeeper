#!/usr/bin/env bash
set -euo pipefail
set +H

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

cd "$ROOT_DIR"

echo "== Task 11: Find last GOOD index.ts backup, then install __debug/verify and deploy =="
echo "INDEX_TS: $INDEX_TS"
echo

if ! ls -1 "$INDEX_TS".bak.* >/dev/null 2>&1; then
  echo "ERROR: No backups found at $INDEX_TS.bak.*"
  exit 1
fi

echo "== 1) Search backups newest -> oldest until we find one that passes build+lint =="
GOOD=""
for BAK in $(ls -1t "$INDEX_TS".bak.*); do
  echo
  echo "-- Testing: $BAK"
  cp -a "$BAK" "$INDEX_TS"

  # Build test
  if ! npm --prefix functions run build >/tmp/task11_build_test.log 2>&1; then
    echo "   ❌ build failed (tsc). First error:"
    sed -n '1,25p' /tmp/task11_build_test.log || true
    continue
  fi

  # Lint test (no --fix while searching)
  if ! npm --prefix functions run lint >/tmp/task11_lint_test.log 2>&1; then
    echo "   ❌ lint failed. First error:"
    sed -n '1,25p' /tmp/task11_lint_test.log || true
    continue
  fi

  GOOD="$BAK"
  echo "   ✅ FOUND good backup: $GOOD"
  break
done

if [[ -z "$GOOD" ]]; then
  echo
  echo "ERROR: No backup passed build+lint."
  echo "Showing current file around the parse error area (70-95):"
  nl -ba "$INDEX_TS" | sed -n '70,95p' || true
  exit 1
fi

echo
echo "== 2) Restore GOOD backup and checkpoint it =="
cp -a "$GOOD" "$INDEX_TS"
cp -a "$INDEX_TS" "$INDEX_TS.good.$(date +%Y%m%d-%H%M%S)"

echo
echo "== 3) Remove ANY existing __debug/verify handlers + old markers (safe) =="
TMP="$(mktemp)"
awk '
  BEGIN { inroute=0; inmarker=0 }

  # Remove marker-based blocks completely (start/end marker lines + contents)
  /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY/ { inmarker = 1 - inmarker; next }
  inmarker==1 { next }

  # Remove any route handler that contains __debug/verify
  /app\.get/ && /__debug\/verify/ { inroute=1; next }
  inroute==1 {
    if ($0 ~ /^[[:space:]]*\}\);[[:space:]]*$/) { inroute=0 }
    next
  }

  { print }
' "$INDEX_TS" > "$TMP"
mv "$TMP" "$INDEX_TS"

echo
echo "== 4) Insert ONE dual-route verify handler before DEBUG_HEADERS marker =="
MARKER='// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS ====='
if ! grep -qF "$MARKER" "$INDEX_TS"; then
  echo "ERROR: Marker not found: $MARKER"
  echo "Try: grep -n \"AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS\" -n \"$INDEX_TS\""
  exit 1
fi

VERIFY_BLOCK="$(cat <<'TS'
// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====
app.get(["/api/__debug/verify", "/__debug/verify"], async (req, res) => {
  try {
    const auth = String(req.header("authorization") || "");
    const m = auth.match(/^Bearer[[:space:]]+(.+)$/i);
    const idToken = m ? m[1] : "";
    if (!idToken) return res.status(200).json({ ok: false, error: "missing_bearer" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    return res.status(200).json({
      ok: true,
      uid: decoded.uid,
      aud: decoded.aud,
      iss: decoded.iss,
      iat: decoded.iat,
      exp: decoded.exp,
      email: (decoded as any).email || null,
      firebase: (decoded as any).firebase || null,
    });
  } catch (e) {
    const err = e as any;
    return res.status(200).json({
      ok: false,
      error: String(err?.code || err?.name || "verify_failed"),
      message: String(err?.message || err),
    });
  }
});
// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====
TS
)"

TMP="$(mktemp)"
awk -v marker="$MARKER" -v block="$VERIFY_BLOCK" '
  $0 == marker { print block; print $0; next }
  { print }
' "$INDEX_TS" > "$TMP"
mv "$TMP" "$INDEX_TS"

echo
echo "== 5) Sanity checks =="
echo "-- verify route lines:"
grep -n "__debug/verify" "$INDEX_TS" || true
echo "-- verify marker count (should be exactly 2 lines):"
grep -n "AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY" "$INDEX_TS" || true

echo
echo "== 6) Lint/build/deploy functions:api =="
npm --prefix functions run lint -- --fix
npm --prefix functions run build
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== 7) Probe (no token => JSON missing_bearer, not HTML 404) =="
curl -sS -i "https://api-cbkg2trx7q-uc.a.run.app/api/__debug/verify?t=$(date +%s)" | head -n 40

echo
echo "== DONE ✅ =="
