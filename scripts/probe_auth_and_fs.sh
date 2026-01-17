#!/usr/bin/env bash
set -euo pipefail

CLOUDRUN_BASE="https://api-cbkg2trx7q-uc.a.run.app"
APP_BASE="https://app.ai-gatekeeper.ca"

# If JWT env var is not set, prompt for it
JWT="${JWT:-}"

if [ -z "$JWT" ]; then
  echo "Paste a FRESH Firebase ID token (single line), then press Enter:"
  read -r JWT
fi

# Clean common copy/paste issues: remove surrounding quotes + whitespace
JWT="$(printf %s "$JWT" | tr -d '\r\n' | sed 's/^"//; s/"$//' | tr -d ' ')"

len="$(printf %s "$JWT" | wc -c | tr -d ' ')"
dots="$(printf %s "$JWT" | awk -F. '{print NF-1}')"

echo "JWT_len=$len JWT_dots=$dots"
if [ "$len" -lt 50 ] || [ "$dots" -ne 2 ]; then
  echo "ERROR: Token looks wrong (expected a JWT with exactly 2 dots)."
  exit 2
fi

echo
echo "==> WHOAMI (APP)"
curl -sS -i -H "Authorization: Bearer ${JWT}" \
  "${APP_BASE}/api/baselines/whoami?t=$(date +%s)" | head -n 60

echo
echo "==> WHOAMI (CLOUDRUN)"
curl -sS -i -H "Authorization: Bearer ${JWT}" \
  "${CLOUDRUN_BASE}/api/baselines/whoami?t=$(date +%s)" | head -n 60

echo
echo "==> FS (APP)"
curl -sS -i -H "Authorization: Bearer ${JWT}" \
  "${APP_BASE}/api/baselines/fs?t=$(date +%s)" | head -n 120

echo
echo "==> FS (CLOUDRUN)"
curl -sS -i -H "Authorization: Bearer ${JWT}" \
  "${CLOUDRUN_BASE}/api/baselines/fs?t=$(date +%s)" | head -n 120

echo
echo "DONE"
