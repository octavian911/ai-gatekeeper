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

echo "== Fix: Restore last GOOD index.ts (lint+tsc), then ensure /api/__debug/verify, then deploy =="
echo "INDEX_TS: $INDEX_TS"
echo

echo "== 0) Collect backups (newest first) =="
mapfile -t BACKUPS < <(ls -1t "$INDEX_TS".bak.* 2>/dev/null || true)
if [ "${#BACKUPS[@]}" -eq 0 ]; then
  echo "❌ No backups found at $INDEX_TS.bak.*"
  exit 1
fi
printf "Found %s backups\n" "${#BACKUPS[@]}"
echo

echo "== 1) Find newest backup that passes lint + build =="
GOOD=""
TMP="$INDEX_TS.__tmp_test__"
for b in "${BACKUPS[@]}"; do
  echo "-- testing: $b"
  cp -a "$b" "$TMP"

  # quick sanity: file not empty
  if [ ! -s "$TMP" ]; then
    echo "   ❌ empty file, skip"
    continue
  fi

  # run lint+build against the tmp file by swapping it in briefly
  cp -a "$INDEX_TS" "$INDEX_TS.__pretest__" 2>/dev/null || true
  cp -a "$TMP" "$INDEX_TS"

  if npm --prefix functions run lint >/dev/null 2>&1 && npm --prefix functions run build >/dev/null 2>&1; then
    GOOD="$b"
    echo "   ✅ GOOD backup found: $GOOD"
    rm -f "$INDEX_TS.__pretest__" "$TMP" 2>/dev/null || true
    break
  else
    echo "   ❌ not good (lint/tsc failed)"
    # restore previous working file before next test
    if [ -f "$INDEX_TS.__pretest__" ]; then
      cp -a "$INDEX_TS.__pretest__" "$INDEX_TS"
      rm -f "$INDEX_TS.__pretest__"
    fi
  fi
done

if [ -z "$GOOD" ]; then
  echo
  echo "❌ None of the backups passed lint+build."
  echo "Show current parse error context:"
  nl -ba "$INDEX_TS" | sed -n '60,110p' || true
  exit 1
fi

echo
echo "== 2) Restore GOOD backup permanently =="
cp -a "$GOOD" "$INDEX_TS"
cp -a "$INDEX_TS" "$INDEX_TS.restored.$(date +%Y%m%d-%H%M%S)"
echo "Restored: $GOOD"
echo

echo "== 3) Remove any existing verify handlers (avoid duplicates) =="
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

echo "== 4) Ensure debug headers marker exists (insertion anchor) =="
if ! grep -qF "$MARKER" "$INDEX_TS"; then
  echo "❌ Marker not found: $MARKER"
  echo "Show nearby debug section:"
  grep -n "__debug/headers|__health|app.get" "$INDEX_TS" | head -n 60 || true
  exit 1
fi

echo "== 5) Insert ONE clean dual-route verify handler BEFORE marker =="
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

echo "== 6) Sanity checks =="
grep -n 'app.get(\["/api/__debug/verify", "/__debug/verify"\]' "$INDEX_TS" || true
COUNT="$(grep -c 'app.get(\["/api/__debug/verify", "/__debug/verify"\]' "$INDEX_TS" || true)"
echo "verify route count: $COUNT"
if [ "$COUNT" -ne 1 ]; then
  echo "❌ verify route count is not 1 (it is $COUNT)"
  exit 1
fi
echo

echo "== 7) Lint + build (must pass) =="
npm --prefix functions run lint -- --fix
npm --prefix functions run lint
npm --prefix functions run build
echo

echo "== 8) Deploy functions:api =="
firebase deploy --only functions:api --project "$PROJECT_ID"
echo

echo "== 9) Probe (should be JSON missing_bearer, not HTML 404) =="
curl -sS "https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)" | head -n 60
echo
curl -sS "https://api-cbkg2trx7q-uc.a.run.app/api/__debug/verify?t=$(date +%s)" | head -n 60
echo
echo "== DONE ✅ =="
