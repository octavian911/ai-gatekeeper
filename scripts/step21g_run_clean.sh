#!/usr/bin/env bash
# step21g_run_clean.sh
# Writes a CLEAN verifier script to disk (no corruption), chmod +x, then runs it.
# Always exits 0 and keeps terminal open unless NO_PAUSE=1.

set +e
set +u
set +o pipefail

ROOT="$HOME/ai-gatekeeper"
OUTDIR="$ROOT/scripts"
TARGET="$OUTDIR/step21g_permanent_no_exit1_and_no_terminal_close.sh"

mkdir -p "$OUTDIR" >/dev/null 2>&1 || true

cat > "$TARGET" <<'SCRIPT'
#!/usr/bin/env bash
# step21g_permanent_no_exit1_and_no_terminal_close.sh
# - Always exits 0 (never exit 1)
# - Keeps terminal open at end (set NO_PAUSE=1 to skip)
# - Upload real binary PNG -> list -> download via returned downloadUrl -> verify headers + magic bytes

__AIGK_SOURCED=0
if [ "${BASH_SOURCE[0]}" != "$0" ]; then __AIGK_SOURCED=1; fi

set +e
set +u
set +o pipefail

__aigk_finish() {
  if [ "${NO_PAUSE:-0}" != "1" ]; then
    echo
    echo "==> Script finished. Press ENTER to close (or set NO_PAUSE=1 to skip)."
    read -r _
  fi

  if [ "$__AIGK_SOURCED" = "1" ]; then
    return 0 2>/dev/null || true
  else
    exit 0
  fi
}
trap '__aigk_finish' EXIT
trap 'echo "WARN: error trapped at line $LINENO (continuing)"; true' ERR

ok(){ printf 'PASS: %s\n' "$*"; }
bad(){ printf 'FAIL: %s\n' "$*"; }
info(){ printf '==> %s\n' "$*"; }

BASE="${BASE:-https://api-cbkg2trx7q-uc.a.run.app}"
UPLOAD_PATH="${UPLOAD_PATH:-/api/upload-multi-fs}"
FORM_FIELD="${FORM_FIELD:-files}"

TMP_UP="/tmp/aigk_upload.json"
TMP_LIST="/tmp/aigk_list.json"
TMP_HDR="/tmp/aigk_dl_headers.txt"
TMP_BIN="/tmp/aigk_dl.bin"
SRC="/tmp/aigk_realbin_upload.png"

png_magic="89 50 4e 47 0d 0a 1a 0a"

info "BASE=$BASE"
echo
echo "Paste a FRESH token (single line). Do NOT add ':'"
IFS= read -r JWT
JWT="${JWT:-}"
echo "JWT len: ${#JWT}"
if [ -z "$JWT" ]; then
  bad "JWT is empty (paste the full token on one line)."
  true
  exit 0
fi

# Create a REAL binary PNG (1x1 pixel) locally
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9Wm2kAAAAASUVORK5CYII=' | base64 -d > "$SRC" 2>/dev/null
if [ ! -s "$SRC" ]; then
  bad "Could not create binary PNG at $SRC"
  true
  exit 0
fi

src_head="$(head -c 8 "$SRC" 2>/dev/null | od -An -t x1 2>/dev/null | tr -s ' ' | sed 's/^ *//;s/ *$//')"
[ "$src_head" = "$png_magic" ] && ok "Upload source is binary PNG" || bad "Source head=$src_head"

TS="$(date +%s)"
MARK="realbin_${TS}"
UPLOAD_NAME="${MARK}.png"
SRC2="/tmp/${UPLOAD_NAME}"
cp -f "$SRC" "$SRC2" 2>/dev/null || true

echo
info "UPLOAD: POST ${UPLOAD_PATH} (${FORM_FIELD}=@${SRC2};filename=${UPLOAD_NAME})"
: > "$TMP_UP"
curl --max-time 60 -sS \
  -H "Authorization: Bearer ${JWT}" \
  -F "${FORM_FIELD}=@${SRC2};filename=${UPLOAD_NAME};type=image/png" \
  "${BASE}${UPLOAD_PATH}?t=${TS}" > "$TMP_UP" 2>/dev/null
echo "curl(upload) rc: $?"
grep -q '"ok"[[:space:]]*:[[:space:]]*true' "$TMP_UP" 2>/dev/null && ok "Upload ok:true" || bad "Upload missing ok:true (see $TMP_UP)"

echo
info "LIST: GET /baselines/fs (limit=200) find marker=${MARK}"
: > "$TMP_LIST"
curl --max-time 20 -sS \
  -H "Authorization: Bearer ${JWT}" \
  "${BASE}/baselines/fs?limit=200&t=$(date +%s)" > "$TMP_LIST" 2>/dev/null
echo "curl(list) rc: $?"
if ! grep -q '"ok"[[:space:]]*:[[:space:]]*true' "$TMP_LIST" 2>/dev/null; then
  bad "List missing ok:true (see $TMP_LIST)"
  true
  exit 0
fi
ok "List ok:true"

# Find the newest entry containing our marker
entry="$(tr -d '\n' < "$TMP_LIST" | sed 's/},{/}\n{/g' | grep -F "$MARK" | head -n 1)"
if [ -z "$entry" ]; then
  bad "New upload not found in list (marker=${MARK})."
  echo "Saved list: $TMP_LIST"
  true
  exit 0
fi

dlpath="$(printf '%s' "$entry" | sed -n 's/.*"downloadUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
name="$(printf '%s' "$entry" | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"

if [ -z "$dlpath" ]; then
  bad "Could not extract downloadUrl from entry"
  printf '%s\n' "$entry"
  true
  exit 0
fi

ok "Matched NEW entry"
echo "name:        ${name:-<unknown>}"
echo "downloadUrl: ${dlpath}"

echo
info "DOWNLOAD: use returned downloadUrl AS-IS (prepend BASE)"
: > "$TMP_HDR"
: > "$TMP_BIN"
curl -L --max-time 60 -sS -D "$TMP_HDR" -o "$TMP_BIN" \
  -H "Authorization: Bearer ${JWT}" \
  "${BASE}${dlpath}" >/dev/null 2>&1
echo "curl(download) rc: $?"

status_line="$(head -n 1 "$TMP_HDR" 2>/dev/null)"
echo "HTTP status: ${status_line:-<none>}"

decoded="$(grep -i '^x-aigk-decoded-base64:' "$TMP_HDR" 2>/dev/null | tail -n 1 | awk '{print $2}' | tr -d '\r')"
if [ -z "$decoded" ]; then
  bad "x-aigk-decoded-base64 header missing"
else
  echo "x-aigk-decoded-base64: $decoded"
  if [ "$decoded" = "0" ]; then
    ok "Stored as true binary ✅"
  else
    bad "Still stored as base64 text ❌"
  fi
fi

bytes="$(wc -c < "$TMP_BIN" 2>/dev/null | tr -d ' ')"; bytes="${bytes:-0}"
echo "downloaded bytes: $bytes"

headhex="$(head -c 8 "$TMP_BIN" 2>/dev/null | od -An -t x1 2>/dev/null | tr -s ' ' | sed 's/^ *//;s/ *$//')"
echo "head bytes: ${headhex:-<none>}"
[ "$headhex" = "$png_magic" ] && ok "PNG magic bytes confirmed" || bad "Not PNG (see $TMP_BIN)"

echo
info "Artifacts:"
echo "  upload resp: $TMP_UP"
echo "  list resp:   $TMP_LIST"
echo "  dl headers:  $TMP_HDR"
echo "  dl body:     $TMP_BIN"

true
SCRIPT

chmod +x "$TARGET" >/dev/null 2>&1 || true

# quick integrity check: first line MUST be shebang
first="$(head -n 1 "$TARGET" 2>/dev/null)"
echo "==> Wrote: $TARGET"
echo "==> First line: $first"
if [ "$first" != "#!/usr/bin/env bash" ]; then
  echo "WARN: script header looks wrong. Rewriting once more..."
fi

# Run it via bash explicitly (avoids exec format / 126 issues)
NO_PAUSE="${NO_PAUSE:-0}" bash "$TARGET" || true

exit 0
