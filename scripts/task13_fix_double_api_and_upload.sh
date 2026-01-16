#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/ai-gatekeeper"
FIDX="${ROOT}/functions/src/index.ts"
UPANEL="${ROOT}/frontend/src/components/UploadPanel.tsx"

echo "== Task 13: Fix double /api, fix routes, fix upload endpoint + headers =="

cd "$ROOT"

echo "== 0) Sanity checks =="
[ -f "$FIDX" ] || { echo "Missing $FIDX"; exit 1; }
[ -f "$UPANEL" ] || { echo "Missing $UPANEL"; exit 1; }

echo "== 1) BACKUP files =="
ts="$(date +%Y%m%d-%H%M%S)"
cp -a "$FIDX"   "$FIDX.bak.$ts"
cp -a "$UPANEL" "$UPANEL.bak.$ts"

echo "== 2) BACKEND: remove internal '/api' prefix if present =="
# If your function currently defines routes like "/api/baselines/..." or mounts app.use("/api", ...)
# this will cause /api/api once Hosting rewrites /api/** to the function.
# Fix by removing the extra /api from route definitions and mounting.
sed -i \
  -e 's#app\.use(\s*["'\'']\/api["'\'']\s*,#app.use("/",#g' \
  -e 's#["'\'']\/api\/__debug\/#"/__debug/#g' \
  -e 's#["'\'']\/api\/baselines\/#"/baselines/#g' \
  "$FIDX"

echo "== 3) BACKEND: read Authorization header robustly =="
# Express lowercases headers, so req.headers.Authorization is undefined.
# Normalize to req.headers.authorization and tolerate 'Bearer <token>'
sed -i \
  -e 's#req\.headers\.Authorization#req.headers.authorization#g' \
  -e 's#req\.headers\["Authorization"\]#req.headers["authorization"]#g' \
  "$FIDX"

echo "== 4) FRONTEND: ensure UploadPanel posts to /api/baselines/upload-multi-fs =="
# UploadPanel must call the Hosting rewrite path /api/... (NOT /baselines/... and NOT /api/api/...)
sed -i \
  -e 's#fetch("/baselines/upload-multi-fs"#fetch("/api/baselines/upload-multi-fs"#g' \
  -e 's#fetch("/api/api/baselines/upload-multi-fs"#fetch("/api/baselines/upload-multi-fs"#g' \
  -e 's#fetch("/api/baselines/upload-multi-fs"#fetch("/api/baselines/upload-multi-fs"#g' \
  "$UPANEL"

echo "== 5) FRONTEND: DO NOT set Content-Type when sending FormData =="
# If your code sets headers["Content-Type"] it breaks multipart boundary -> backend 400
# Remove any explicit Content-Type for UploadPanel only (keep Authorization).
# (This is safe even if the line doesn't exist.)
sed -i \
  -e '/Content-Type.*multipart\/form-data/d' \
  -e '/Content-Type.*application\/json/d' \
  "$UPANEL"

echo "== 6) FRONTEND: fix any literal /api/api occurrences =="
# Some files generate /api/api dynamically (baseURL + hardcoded /api).
# We can at least remove literal occurrences if any.
grep -RIl "/api/api" frontend/src frontend/client.ts 2>/dev/null | while read -r f; do
  sed -i 's#/api/api#/api#g' "$f"
done

echo "== 7) Show current occurrences of suspicious patterns =="
echo "-- /api/api occurrences (should be none):"
grep -RIn "/api/api" frontend/src frontend/client.ts 2>/dev/null || true

echo "-- backend route strings containing '/api/' (should be none after fix):"
grep -nE '"/api/|'\''/api/' "$FIDX" || true

echo "== 8) Rebuild frontend (auto-detect bun/npm) =="
if command -v bun >/dev/null 2>&1; then
  (cd frontend && bun install && bun run build)
else
  (cd frontend && npm ci && npm run build)
fi

echo
echo "== 9) Deploy (run ONE of these, depending on your setup) =="
echo "Firebase (recommended): firebase deploy --only functions,hosting"
echo "If you're using GH Actions deploy, commit + push and let pipeline run."
echo
echo "DONE. Now re-test in browser Network tab:"
echo " - GET /api/baselines/git-status should be 200 (not /api/api/...)"
echo " - POST /api/baselines/upload-multi-fs should be 200/201 (not 400)"
