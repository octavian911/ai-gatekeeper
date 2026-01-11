#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-ai-gatekeeper-ea724}"
REGION="${2:-us-central1}"
BASE="${3:-https://api-cbkg2trx7q-uc.a.run.app}"

: "${FIREBASE_WEB_API_KEY:?Set FIREBASE_WEB_API_KEY first (AIza...)}"

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required (JSON parsing). Install it first."
  exit 2
fi

echo "==> 1) Mint anonymous Firebase ID token"
TOKEN_JSON="$(
  curl -sS --http1.1 \
    -H "Content-Type: application/json" \
    "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FIREBASE_WEB_API_KEY" \
    -d '{"returnSecureToken":true}'
)"
TOKEN="$(echo "$TOKEN_JSON" | jq -r '.idToken // empty')"
if [ -z "$TOKEN" ]; then
  echo "❌ Could not mint idToken. Common causes:"
  echo "   - Anonymous Auth not enabled (Firebase Console → Auth → Sign-in method → Anonymous → Enable)"
  echo "   - Wrong FIREBASE_WEB_API_KEY"
  echo "---- token json ----"
  echo "$TOKEN_JSON" | head -c 1200; echo
  exit 3
fi
echo "✅ TOKEN len=${#TOKEN}"

echo "==> 2) Confirm backend sees auth + env (/api/debug/env)"
ENV_JSON="$(
  curl -sS --http1.1 \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE/api/debug/env" || true
)"
# If it’s HTML, jq will fail; detect that.
if echo "$ENV_JSON" | head -c 1 | grep -q '<'; then
  echo "❌ /api/debug/env returned HTML (wrong BASE or route not deployed)."
  echo "BASE=$BASE"
  echo "---- body (first 400) ----"
  echo "$ENV_JSON" | head -c 400; echo
  exit 4
fi

OK="$(echo "$ENV_JSON" | jq -r '.ok // false')"
if [ "$OK" != "true" ]; then
  echo "❌ /api/debug/env not ok. Response:"
  echo "$ENV_JSON" | jq . || { echo "$ENV_JSON"; }
  exit 5
fi

UPLOAD_BUCKET="$(echo "$ENV_JSON" | jq -r '.uploadBucket // empty')"
API_REGION="$(echo "$ENV_JSON" | jq -r '.apiRegion // empty')"
ENV_PROJECT="$(echo "$ENV_JSON" | jq -r '.projectId // empty')"

echo "✅ debug/env:"
echo "   projectId=$ENV_PROJECT"
echo "   apiRegion=$API_REGION"
echo "   uploadBucket=$UPLOAD_BUCKET"

if [ -z "$UPLOAD_BUCKET" ] || [ "$UPLOAD_BUCKET" = "unknown-uploads" ]; then
  echo "❌ uploadBucket is empty/invalid from backend. Fix functions/.env and redeploy first."
  exit 6
fi

echo "==> 3) Ensure bucket exists: gs://$UPLOAD_BUCKET"
if ! command -v gsutil >/dev/null 2>&1; then
  echo "❌ gsutil not found. Install Google Cloud SDK (or enable it in your environment) then rerun."
  exit 7
fi

if gsutil ls -b "gs://$UPLOAD_BUCKET" >/dev/null 2>&1; then
  echo "✅ Bucket exists"
else
  echo "Creating bucket..."
  gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$UPLOAD_BUCKET"
  echo "✅ Bucket created"
fi

echo "==> 4) Ensure Cloud Run service account can write to bucket"
if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ gcloud not found. Install Google Cloud SDK then rerun."
  exit 8
fi

SA="$(
  gcloud run services describe api \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true
)"
# Some setups may return empty; fallback to project default compute SA.
if [ -z "$SA" ]; then
  SA="${PROJECT_ID}@appspot.gserviceaccount.com"
fi

echo "Using service account: $SA"

# Grant object admin on this bucket (idempotent; may add duplicate binding in policy output but works)
gsutil iam ch "serviceAccount:${SA}:roles/storage.objectAdmin" "gs://$UPLOAD_BUCKET" >/dev/null 2>&1 || true
echo "✅ IAM ensured (storage.objectAdmin on bucket)"

echo "==> 5) Upload test file (must return count>=1)"
echo "hello" > /tmp/hello_sanity.txt

HDR=/tmp/e2e_upload_headers.txt
BODY=/tmp/e2e_upload_body.json
rm -f "$HDR" "$BODY"

curl -sS --http1.1 -D "$HDR" -o "$BODY" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/tmp/hello_sanity.txt;type=text/plain" \
  "$BASE/api/upload-multi-fs" || true

echo "---- status/headers (first 30 lines) ----"
sed -n '1,30p' "$HDR" || true
echo "---- body ----"
cat "$BODY" | head -c 4000; echo

# If HTML, wrong route/base.
if head -c 1 "$BODY" | grep -q '<'; then
  echo "❌ Upload returned HTML. BASE is likely wrong for API."
  exit 9
fi

UPLOAD_OK="$(jq -r '.ok // false' < "$BODY" 2>/dev/null || echo false)"
COUNT="$(jq -r '.count // 0' < "$BODY" 2>/dev/null || echo 0)"

if [ "$UPLOAD_OK" = "true" ] && [ "$COUNT" -ge 1 ]; then
  echo "✅ Upload succeeded (count=$COUNT)"
  echo "✅ Permanent pipeline confirmed."
  exit 0
fi

echo "❌ Upload FAILED or accepted 0 files."
echo "   This is the KEY: you are no longer allowed to get ok:true count:0 and pretend it worked."
echo "   Investigate the JSON above. If it says no_files_accepted / mime_not_allowed / wrong_fieldname, that’s the exact fix."
exit 10
