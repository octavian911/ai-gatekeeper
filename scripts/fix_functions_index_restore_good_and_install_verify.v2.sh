#!/usr/bin/env bash
set -Eeuo pipefail
set +H

trap 'echo; echo "❌ FAILED (line $LINENO): $BASH_COMMAND"; exit 1' ERR

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
MARKER='// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS ====='

cd "$ROOT_DIR"

echo "== Fix v2: find GOOD index.ts backup, restore, insert verify, deploy =="
echo "INDEX_TS: $INDEX_TS"
echo

echo "== 0) Collect backups newest->oldest =="
mapfile -t BACKUPS < <(ls -1t "$INDEX_TS".bak.* 2>/dev/null || true)
if [ "${#BACKUPS[@]}" -eq 0 ]; then
  echo "❌ No backups found: $INDEX_TS.bak.*"
  exit 1
fi
echo "Found ${#BACKUPS[@]} backups"
echo

GOOD=""
TMP="$INDEX_TS.__tmp__"
PRE="$INDEX_TS.__pre__"

echo "== 1) Test backups until one passes lint + tsc (show first error when it fails) =="
for b in "${BACKUPS[@]}"; do
  echo
  echo "-- testing: $b"
  cp -a "$b" "$TMP"

  cp -a "$INDEX_TS" "$PRE" 2>/dev/null || true
  cp -a "$TMP" "$INDEX_TS"

  # Lint
  if ! npm --prefix functions run lint >/tmp/_lint.out 2>&1; then
    echo "   ❌ lint failed. First error:"
    sed -n '1,40p' /tmp/_lint.out
    cp -a "$PRE" "$INDEX_TS" 2>/dev/null || true
    continue
  fi

  # Build (tsc)
  if ! npm --prefix functions run build >/tmp/_build.out 2>&1; then
    echo "   ❌ tsc failed. First error:"
    sed -n '1,60p' /tmp/_build.out
    cp -a "$PRE" "$INDEX_TS" 2>/dev/null || true
    continue
  fi

  GOOD="$b"
  echo "   ✅ GOOD backup: $GOOD"
  break
done

rm -f "$TMP" "$PRE" /tmp/_lint.out /tmp/_build.out 2>/dev/null || true

if [ -z "$GOOD" ]; then
  echo
  echo "❌ No backup passed lint+tsc. We need to inspect current index.ts around the parse break."
  nl -ba "$INDEX_TS" | sed -n '60,120p' || true
  exit 1
fi

echo
echo "== 2) Restore GOOD backup permanently =="
cp -a "$GOOD" "$INDEX_TS"
cp -a "$INDEX_TS" "$INDEX_TS.restored.$(date +%Y%m%d-%H%M%S)"
echo "Restored: $GOOD"
echo

echo "== 3) Remove any existing verify handlers/markers (avoid duplicates) =="
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
' "$INDEX_TS" > /tmp/index.ts.noverify
mv /tmp/index.ts.noverify "$INDEX_TS"
echo

echo "== 4) Confirm insertion anchor exists =="
if ! grep -qF "$MARKER" "$INDEX_TS"; then
  echo "❌ Missing marker: $MARKER"
  grep -n "__debug/headers|__health|app.get" "$INDEX_TS" | head -n 80 || true
  exit 1
fi
echo "Anchor OK"
echo

echo "== 5) Insert ONE clean dual-route verify handler before marker =="
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
    const err = (e || {}) as any;
    return res.status(200).json({
      ok: false,
      error: String(err.code || err.name || "verify_failed"),
      message: String(err.message || err),
    });
  }
});
 // ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====
'

awk -v anchor="$MARKER" -v block="$VERIFY_BLOCK" '
BEGIN{ins=0}
{
  if (ins==0 && $0==anchor) {print block; ins=1}
  print
}
' "$INDEX_TS" > /tmp/index.ts.withverify
mv /tmp/index.ts.withverify "$INDEX_TS"

echo "== 6) Sanity: verify route count must be 1 =="
COUNT="$(grep -c 'app.get(\["/api/__debug/verify", "/__debug/verify"\]' "$INDEX_TS" || true)"
grep -n 'app.get(\["/api/__debug/verify", "/__debug/verify"\]' "$INDEX_TS" || true
echo "verify route count: $COUNT"
[ "$COUNT" -eq 1 ]
echo

echo "== 7) Lint + build + deploy =="
npm --prefix functions run lint -- --fix
npm --prefix functions run lint
npm --prefix functions run build
firebase deploy --only functions:api --project "$PROJECT_ID"
echo

echo "== 8) Probe verify (should be JSON) =="
curl -sS "https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)" | head -n 60
echo
echo "== DONE ✅ =="
