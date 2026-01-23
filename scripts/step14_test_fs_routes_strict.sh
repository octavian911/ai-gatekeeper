#!/usr/bin/env bash
set -euo pipefail

BASE="https://api-cbkg2trx7q-uc.a.run.app"

echo "==> Paste a FRESH Firebase ID token (must start with eyJ and contain 2 dots)"
echo "    Then press Enter. (If you press Enter on an empty line, this script will abort.)"
IFS= read -r JWT

# Must not be empty
if [ -z "${JWT}" ]; then
  echo "ERROR: token is empty. You must paste the full Firebase ID token." >&2
  exit 2
fi

# Must not include spaces/newlines
if printf %s "$JWT" | grep -q '[[:space:]]'; then
  echo "ERROR: token contains whitespace. Paste it as a single line." >&2
  exit 2
fi

# Must look like a JWT
DOTS="$(printf %s "$JWT" | awk -F. '{print NF-1}')"
HEAD="${JWT:0:12}"
TAIL="${JWT: -12}"

echo "==> token sanity"
echo "len=$(printf %s "$JWT" | wc -c | tr -d ' ') dots=$DOTS head=$HEAD tail=$TAIL"

case "$JWT" in
  eyJ*.*.*) : ;;
  ghp_*) echo "ERROR: That is a GitHub token (ghp_), NOT a Firebase ID token." >&2; exit 2 ;;
  *) echo "ERROR: Not a valid-looking Firebase ID token. Must start with eyJ and have 2 dots." >&2; exit 2 ;;
esac

echo
echo "==> fs_debug (expect HTTP 200)"
curl -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/api/baselines/fs_debug?t=$(date +%s)" | head -n 60

echo
echo "==> fs list (/api) (expect HTTP 200 or JSON 504 fs_list_timeout)"
curl -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 120

echo
echo "==> fs list (/baselines) (expect same)"
curl -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 120
