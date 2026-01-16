#!/usr/bin/env bash
set -euo pipefail

SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== API surface smoke =="
echo "Site: https://$SITE"
echo

check() {
  local path="$1"
  echo "-- GET $path"
  local out
  out="$(curl -sS -D- "https://$SITE$path" -o /tmp/_body.txt || true)"
  echo "$out" | sed -n '1,12p'
  echo "BODY (first 200 chars):"
  head -c 200 /tmp/_body.txt; echo
  echo
}

check "/api/baselines"
check "/api/baselines/upload-multi-fs"

echo "DONE"
