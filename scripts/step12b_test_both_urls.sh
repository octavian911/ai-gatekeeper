#!/usr/bin/env bash
set -euo pipefail

PROJECT="ai-gatekeeper-ea724"
REGION="us-central1"
SERVICE="api"

# Cloud Functions URL (what firebase deploy prints)
FN_URL="https://api-cbkg2trx7q-uc.a.run.app"

# Direct Cloud Run service URL (what gcloud run update prints / actual service status URL)
RUN_URL="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT" \
  --format='value(status.url)')"

echo "==> Paste a FRESH Firebase ID token (single line)."
unset JWT 2>/dev/null || true
read -r JWT
export JWT

echo "==> sanity: len/dots"
echo "len=$(printf %s "$JWT" | wc -c) dots=$(printf %s "$JWT" | awk -F. '{print NF-1}') head=${JWT:0:12} tail=${JWT: -12}"

req() {
  local base="$1"
  local path="$2"
  echo
  echo "=== $base$path ==="
  curl -sS -i -H "Authorization: Bearer $JWT" "$base$path" | head -n 40
}

echo
echo "==> URLs"
echo "FN_URL =$FN_URL"
echo "RUN_URL=$RUN_URL"

req "$FN_URL"  "/api/baselines/fs_debug?t=$(date +%s)"
req "$FN_URL"  "/api/baselines/fs?limit=5&t=$(date +%s)"

req "$RUN_URL" "/api/baselines/fs_debug?t=$(date +%s)"
req "$RUN_URL" "/api/baselines/fs?limit=5&t=$(date +%s)"
