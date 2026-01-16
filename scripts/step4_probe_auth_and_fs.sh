#!/usr/bin/env bash
set -euo pipefail

CLOUDRUN_BASE="https://api-cbkg2trx7q-uc.a.run.app"
APP_BASE="https://app.ai-gatekeeper.ca"

# Prefer existing env var if already set
JWT="${JWT:-}"

if [ -z "$JWT" ]; then
  echo "Paste a FRESH Firebase ID token (single line), then press Enter:"
  read -r JWT
fi

if [ -z "$JWT" ]; then
  echo "ERROR: JWT is empty."
  exit 2
fi

dots="$(printf %s "$JWT" | awk -F. '{print NF-1}')"
len="$(printf %s "$JWT" | wc -c | tr -d ' ')"
head12="$(printf %s "$JWT" | cut -c1-12)"
tail12="$(printf %s "$JWT" | awk '{print substr($0, length($0)-11)}')"

echo "JWT_len=${len} JWT_dots=${dots} head=${head12}... tail=...${tail12}"

if [ "$dots" != "2" ]; then
  echo "ERROR: JWT must have exactly 2 dots."
  exit 3
fi

call() {
  local url="$1"
  echo
  echo "==> GET $url"
  # show headers
  curl -sS -i -H "Authorization: Bearer ${JWT}" "${url}?t=$(date +%s)" | sed -n '1,40p'
  echo
  echo "----- body -----"
  curl -sS -H "Authorization: Bearer ${JWT}" "${url}?t=$(date +%s)" || true
  echo
}

# WHOAMI (should be 200)
call "${APP_BASE}/api/baselines/whoami"
call "${CLOUDRUN_BASE}/api/baselines/whoami"

# FS (this is the failing one)
call "${APP_BASE}/api/baselines/fs"
call "${CLOUDRUN_BASE}/api/baselines/fs"

echo "DONE"
