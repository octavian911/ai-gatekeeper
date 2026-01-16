#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FIREBASE_JSON="${FIREBASE_JSON:-$ROOT_DIR/firebase.json}"

echo "== Smoke Test: hosting + routes + api rewrite existence =="
echo "Project: $PROJECT_ID"
echo "Site:    $SITE"
echo "Repo:    $ROOT_DIR"
echo

# 1) firebase.json exists
[[ -f "$FIREBASE_JSON" ]] || { echo "ERROR: firebase.json missing at $FIREBASE_JSON"; exit 1; }
echo "✅ firebase.json exists"

# 2) Landing works
echo
echo "== Check / =="
code="$(curl -sS -o /tmp/smoke_root.html -w '%{http_code}' "https://${SITE}/")"
echo "HTTP: $code"
[[ "$code" == "200" ]] || { echo "ERROR: / not 200"; exit 1; }
echo "✅ / is reachable"

# 3) Baselines route loads (SPA)
echo
echo "== Check /baselines =="
code="$(curl -sS -o /tmp/smoke_baselines.html -w '%{http_code}' "https://${SITE}/baselines")"
echo "HTTP: $code"
[[ "$code" == "200" ]] || { echo "ERROR: /baselines not 200"; exit 1; }
echo "✅ /baselines is reachable"

# 4) Reviews route loads (SPA)
echo
echo "== Check /reviews =="
code="$(curl -sS -o /tmp/smoke_reviews.html -w '%{http_code}' "https://${SITE}/reviews")"
echo "HTTP: $code"
[[ "$code" == "200" ]] || { echo "ERROR: /reviews not 200"; exit 1; }
echo "✅ /reviews is reachable"

# 5) API route exists (may be 401; that's still "exists")
echo
echo "== Check API route existence (expect 401 or 4xx JSON, NOT HTML) =="
api_code="$(curl -sS -o /tmp/smoke_api.txt -w '%{http_code}' -X POST "https://${SITE}/api/upload-multi-fs" || true)"
ctype="$(curl -sSI -X POST "https://${SITE}/api/upload-multi-fs" | awk -F': ' 'tolower($1)=="content-type"{print $2}' | tr -d '\r' || true)"
echo "HTTP:  $api_code"
echo "CTYPE: $ctype"
head -c 120 /tmp/smoke_api.txt; echo

if echo "$ctype" | grep -qi "text/html"; then
  echo "ERROR: API is returning Hosting HTML (rewrite broken)."
  exit 1
fi

echo "✅ API route responds (even if unauthorized)."
echo
echo "DONE ✅"
