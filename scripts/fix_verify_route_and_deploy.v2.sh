#!/usr/bin/env bash
set -Eeuo pipefail
set +H

trap 'echo; echo "❌ FAILED (line $LINENO): $BASH_COMMAND"; echo "---- tail log ----"; tail -n 120 /tmp/fix_verify_route_and_deploy.v2.log 2>/dev/null || true; exit 1' ERR

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
INDEX_TS="${INDEX_TS:-$ROOT_DIR/functions/src/index.ts}"

cd "$ROOT_DIR"

echo "== Fix Verify Route v2: clean insert + deploy =="
echo "PROJECT: $PROJECT_ID"
echo "INDEX_TS: $INDEX_TS"
echo

# 0) Safety backup
cp -a "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

echo "== A) Confirm we have an insertion anchor =="
# Prefer the debug headers marker, else fallback to /api/__health, else fallback to first app.get(
ANCHOR='// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS ====='
if grep -qF "$ANCHOR" "$INDEX_TS"; then
  echo "Anchor: DEBUG_HEADERS marker"
  ANCHOR_MODE="DEBUG_MARKER"
elif grep -q 'app\.get\("/api/__health"' "$INDEX_TS"; then
  echo "Anchor: /api/__health"
  ANCHOR_MODE="HEALTH"
elif grep -q 'app\.get\(' "$INDEX_TS"; then
  echo "Anchor: first app.get("
  ANCHOR_MODE="FIRST_APP_GET"
else
  echo "❌ No suitable insertion anchor found in index.ts"
  exit 1
fi
echo

echo "== B) Remove ANY existing __debug/verify handlers + verify markers (avoid duplicates) =="
# Delete all verify routes if present; keep it simple and safe.
# This removes blocks starting at a verify app.get(...) line until the next line that ends with '});'
awk '
BEGIN{del=0}
{
  if ($0 ~ /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY/) next
  if ($0 ~ /app\.get\(\["\/api\/__debug\/verify", "\/__debug\/verify"\]/) {del=1; next}
  if ($0 ~ /app\.get\("\/api\/__debug\/verify"/) {del=1; next}
  if ($0 ~ /app\.get\("\/__debug\/verify"/) {del=1; next}
  if (del==1) {
    if ($0 ~ /^\s*\}\);\s*$/) {del=0; next}
    next
  }
  print
}
' "$INDEX_TS" > /tmp/index.ts.clean
mv /tmp/index.ts.clean "$INDEX_TS"

echo "== C) Insert ONE clean dual-route verify handler =="
VERIFY_BLOCK='// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====
app.get(["/api/__debug/verify", "/__debug/verify"], async (req, res) => {
  try {
    const authHeader = String(req.get("authorization") || "");
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
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
    const err: any = e || {};
    return res.status(200).json({
      ok: false,
      error: String(err.code || err.name || "verify_failed"),
      message: String(err.message || err),
    });
  }
});
 // ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====
'

if [ "$ANCHOR_MODE" = "DEBUG_MARKER" ]; then
  awk -v anchor="$ANCHOR" -v block="$VERIFY_BLOCK" '
  BEGIN{ins=0}
  {
    if (ins==0 && $0==anchor) {print block; ins=1}
    print
  }' "$INDEX_TS" > /tmp/index.ts.new

elif [ "$ANCHOR_MODE" = "HEALTH" ]; then
  awk -v block="$VERIFY_BLOCK" '
  BEGIN{ins=0}
  {
    if (ins==0 && $0 ~ /app\.get\("\/api\/__health"/) {print block; ins=1}
    print
  }' "$INDEX_TS" > /tmp/index.ts.new

else
  awk -v block="$VERIFY_BLOCK" '
  BEGIN{ins=0}
  {
    if (ins==0 && $0 ~ /app\.get\(/) {print block; ins=1}
    print
  }' "$INDEX_TS" > /tmp/index.ts.new
fi

mv /tmp/index.ts.new "$INDEX_TS"

echo "== D) Sanity checks (should be exactly 1 route line) =="
grep -n 'app.get(\["/api/__debug/verify", "/__debug/verify"\]' "$INDEX_TS" || true
COUNT="$(grep -c 'app.get(\["/api/__debug/verify", "/__debug/verify"\]' "$INDEX_TS" || true)"
echo "verify route count: $COUNT"
if [ "$COUNT" -ne 1 ]; then
  echo "❌ verify route count is not 1 (it is $COUNT). Aborting."
  exit 1
fi
echo

echo "== E) Lint + Build + Deploy functions:api =="
npm --prefix functions run lint -- --fix
npm --prefix functions run build
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== F) Probe (should return JSON missing_bearer) =="
curl -sS -i "https://api-cbkg2trx7q-uc.a.run.app/api/__debug/verify?t=$(date +%s)" | head -n 40
echo
curl -sS -i "https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)" | head -n 40

echo "== DONE ✅ =="
