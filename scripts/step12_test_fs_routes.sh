#!/usr/bin/env bash
set -euo pipefail

BASE="https://api-cbkg2trx7q-uc.a.run.app"

echo "==> 1) Paste a FRESH Firebase ID token (must start with eyJ and have 2 dots)"
unset JWT || see 2>/dev/null || true
read -r JWT
export JWT

# Sanity check: must look like a JWT, not ghp_ (GitHub token) and not empty
case "$JWT" in
  eyJ*.*.*) ;;
  ghp_*) echo "ERROR: That is a GitHub token (ghp_*), not a Firebase ID token."; exit 1 ;;
  "") echo "ERROR: Empty token read. Paste the JWT then press Enter."; exit 1 ;;
  *) echo "ERROR: Not a JWT. It must start with eyJ and contain 2 dots."; exit 1 ;;
esac

echo "==> token sanity"
echo "len=$(printf %s "$JWT" | wc -c) dots=$(printf %s "$JWT" | awk -F. '{print NF-1}') head=${JWT:0:12} tail=${JWT: -12}"

echo
echo "==> 2) fs_debug (should be HTTP 200 and show uid)"
curl -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/api/baselines/fs_debug?t=$(date +%s)" | head -n 80

echo
echo "==> 3) fs list (should be HTTP 200 with files[] and downloadUrl fields)"
RESP="$(curl -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/api/baselines/fs?limit=5&t=$(date +%s)")"

echo "$RESP" | head -n 120

# Extract first file name from the JSON body without jq
BODY="$(printf "%s" "$RESP" | awk 'BEGIN{h=1} /^\r?$/{h=0;next} {if(!h)print}')"
NAME="$(printf "%s" "$BODY" | sed -n 's/.*"name":"\([^"]*\)".*/\1/p' | head -n 1)"

if [ -z "${NAME:-}" ]; then
  echo
  echo "NOTE: No file name extracted. Either files[] is empty, or the response isn't JSON."
  echo "If files[] is empty, upload something first and re-run."
  exit 0
fi

echo
echo "==> 4) fs_download proxy (should stream content; expect HTTP 200)"
echo "Downloading name=$NAME"
curl -sS -I -H "Authorization: Bearer $JWT" \
  "$BASE/api/baselines/fs_download?name=$(python3 - <<PY
import urllib.parse
print(urllib.parse.quote("""$NAME"""))
PY
)" | head -n 40

echo
echo "✅ If steps 2 and 3 are 200, Step12 worked."
