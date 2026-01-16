#!/usr/bin/env bash
set -euo pipefail
set +H  # disable history expansion ("!m" issues)

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"

echo "== Task 11 Fix: Restore -> clean verify blocks -> re-insert -> deploy =="
echo "INDEX_TS: $INDEX_TS"

cd "$ROOT_DIR"

echo
echo "== 1) Restore latest backup (must exist) =="
LATEST_BAK="$(ls -1t "$INDEX_TS".bak.* 2>/dev/null | head -n 1 || true)"
if [[ -z "${LATEST_BAK:-}" ]]; then
  echo "ERROR: No backups found at: $INDEX_TS.bak.*"
  echo "Run: ls -la $(dirname "$INDEX_TS") | grep index.ts"
  exit 1
fi
echo "Restoring: $LATEST_BAK"
cp -a "$LATEST_BAK" "$INDEX_TS"

# Keep another safety backup after restore
cp -a "$INDEX_TS" "$INDEX_TS.fixbak.$(date +%Y%m%d-%H%M%S)"

echo
echo "== 2) Remove any existing verify blocks (all duplicates) =="
TMP="$(mktemp)"
awk '
  BEGIN { skip=0 }
  # Remove any marker-based blocks completely (even if duplicated)
  /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY/ { skip = 1 - skip; next }
  skip==1 { next }

  # Also remove any standalone __debug/verify handlers (best-effort)
  /app\.get\(\[.*__debug\/verify/ { inroute=1; next }
  /app\.get\(\"\/api\/__debug\/verify\"/ { inroute=1; next }
  /app\.get\(\"\/__debug\/verify\"/ { inroute=1; next }
  inroute==1 {
    if ($0 ~ /^\s*\}\);\s*$/) { inroute=0 }
    next
  }

  { print }
' "$INDEX_TS" > "$TMP"
mv "$TMP" "$INDEX_TS"

echo
echo "== 3) Insert ONE safe dual-route verify handler before DEBUG_HEADERS marker =="
MARKER='// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS ====='
if ! grep -qF "$MARKER" "$INDEX_TS"; then
  echo "ERROR: Marker not found: $MARKER"
  echo "Try: grep -n \"DEBUG_HEADERS\" -n \"$INDEX_TS\""
  exit 1
fi

VERIFY_BLOCK="$(cat <<'TS'
// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====
app.get(["/api/__debug/verify", "/__debug/verify"], async (req, res) => {
  try {
    const auth = String(req.header("authorization") || "");
    const m = auth.match(/^Bearer\s+(.+)$/i);
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
  $0 == marker {
    print block
    print $0
    next
  }
  { print }
' "$INDEX_TS" > "$TMP"
mv "$TMP" "$INDEX_TS"

echo
echo "== 4) Sanity checks =="
echo "-- verify routes:"
grep -n "__debug/verify" "$INDEX_TS" || true
echo "-- verify markers count (should be 2 lines total):"
grep -n "AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY" "$INDEX_TS" || true

echo
echo "== 5) Lint/build/deploy functions:api =="
npm --prefix functions run lint -- --fix
npm --prefix functions run build
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== 6) Probe (no token => missing_bearer JSON, not HTML 404) =="
curl -sS -i "https://api-cbkg2trx7q-uc.a.run.app/api/__debug/verify?t=$(date +%s)" | head -n 40

echo "== DONE ✅ =="
