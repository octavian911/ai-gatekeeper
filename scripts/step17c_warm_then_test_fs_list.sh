#!/usr/bin/env bash
set -euo pipefail

BASE="https://api-cbkg2trx7q-uc.a.run.app"

echo "Paste fresh Firebase ID token (eyJ... with 2 dots):"
IFS= read -r JWT
if [ -z "${JWT}" ]; then echo "ERROR: empty token" >&2; exit 1; fi

case "$JWT" in
  eyJ*.*.*) ;;
  *) echo "ERROR: token not JWT (must start eyJ and contain 2 dots)" >&2; exit 2 ;;
esac

echo "==> 1) Warm up runtime via fs_debug (no auth middleware path, but hits app + admin init)"
time curl --max-time 20 -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/api/baselines/fs_debug?t=$(date +%s)" | head -n 40

echo
echo "==> 2) NOW test fs list with enough time to distinguish fail-fast vs platform timeout"
echo "    Expect: HTTP 200 JSON OR HTTP 504 JSON (fs_list_timeout)."
echo "    If you still get ZERO bytes until timeout, it means request isn't reaching handler quickly (cold start / platform)."
time curl --max-time 25 -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 120

echo
echo "==> 3) Test /baselines alias too"
time curl --max-time 25 -sS -i -H "Authorization: Bearer $JWT" \
  "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 120
