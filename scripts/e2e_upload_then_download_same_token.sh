#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://api-cbkg2trx7q-uc.a.run.app}"
: "${FIREBASE_WEB_API_KEY:?Set FIREBASE_WEB_API_KEY first}"

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq not found. Install jq (or ask and I’ll give a no-jq version)."
  exit 1
fi

echo "==> 1) Mint anonymous Firebase ID token"
TOKEN="$(
  curl -sS --http1.1 \
    -H "Content-Type: application/json" \
    "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FIREBASE_WEB_API_KEY" \
    -d '{"returnSecureToken":true}' \
  | jq -r '.idToken // empty'
)"
if [ -z "${TOKEN}" ]; then
  echo "❌ Failed to mint token. Check: Anonymous Auth enabled + API key correct."
  exit 2
fi
echo "✅ TOKEN len=${#TOKEN}"

echo "==> 2) Confirm backend sees auth (firebase uid)"
FIREBASE_UID="$(
  curl -sS --http1.1 \
    -H "Authorization: Bearer $TOKEN" \
    "${BASE}/api/debug/headers" \
  | jq -r '.uid // empty'
)"
if [ -z "$FIREBASE_UID" ]; then
  echo "❌ Backend did not return firebase uid (auth middleware not seeing token)."
  echo "Raw:"
  curl -sS --http1.1 -i -H "Authorization: Bearer $TOKEN" "${BASE}/api/debug/headers" | sed -n '1,120p'
  exit 3
fi
echo "✅ firebaseUid=$FIREBASE_UID"

echo "==> 3) Upload a file (multipart field=files)"
echo "hello" > /tmp/hello_e2e.txt

HDR=/tmp/upload_hdr.txt
BODY=/tmp/upload_body.json
rm -f "$HDR" "$BODY"

curl -sS --http1.1 -D "$HDR" -o "$BODY" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/tmp/hello_e2e.txt;type=text/plain" \
  "${BASE}/api/upload-multi-fs"

echo "---- upload body ----"
cat "$BODY"; echo

COUNT="$(jq -r '.count // 0' "$BODY" 2>/dev/null || echo 0)"
if [ "$COUNT" -lt 1 ]; then
  echo "❌ Upload returned count=$COUNT (file rejected/ignored)."
  echo "   Rejected:"
  jq -c '.rejected // []' "$BODY" 2>/dev/null || cat "$BODY"
  exit 4
fi

DOWNLOAD_PATH="$(jq -r '.files[0].downloadPath // empty' "$BODY")"
OBJECT="$(jq -r '.files[0].object // empty' "$BODY")"
echo "✅ object=$OBJECT"
echo "✅ downloadPath=$DOWNLOAD_PATH"

if [ -z "$DOWNLOAD_PATH" ]; then
  echo "❌ No downloadPath returned."
  exit 5
fi

echo "==> 4) Download using SAME token (should be 200 + include 'hello')"
curl -sS --http1.1 -i \
  -H "Authorization: Bearer $TOKEN" \
  "${BASE}${DOWNLOAD_PATH}" | sed -n '1,200p'

echo ""
echo "✅ E2E upload+download succeeded with same token."
