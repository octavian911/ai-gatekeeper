#!/usr/bin/env bash
set -euo pipefail

SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== API surface smoke v2 =="
echo "Site: https://$SITE"
echo

show() {
  local method="$1"
  local path="$2"
  echo "-- $method $path"
  curl -sS -D- -H "Cache-Control: no-cache" -X "$method" "https://$SITE$path" -o /tmp/_body.txt || true
  echo "BODY (first 200 chars):"
  head -c 200 /tmp/_body.txt; echo
  echo
}

# Baselines list (often GET)
show "GET" "/api/baselines"

# Upload endpoint should be POST. We only care that it is NOT "Cannot POST ..." anymore.
# 401/403/400 is OK for this smoke.
show "POST" "/api/baselines/upload-multi-fs"

echo "DONE"
