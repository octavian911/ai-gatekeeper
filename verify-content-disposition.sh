#!/bin/bash
set -e

echo "=== Content-Disposition Verification ==="
echo ""

# Get the export URL
echo "1. Calling export API..."
RESPONSE=$(curl -s https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev/baselines/export.zip)
DOWNLOAD_URL=$(echo "$RESPONSE" | grep -o '"downloadUrl":"[^"]*"' | cut -d'"' -f4)
FILENAME=$(echo "$RESPONSE" | grep -o '"filename":"[^"]*"' | cut -d'"' -f4)

echo "   ✓ Filename from API: $FILENAME"
echo ""

# Check if URL contains response-content-disposition parameter
echo "2. Checking signed URL parameters..."
if echo "$DOWNLOAD_URL" | grep -q "response-content-disposition"; then
  echo "   ✓ URL contains response-content-disposition parameter"
else
  echo "   ✗ URL missing response-content-disposition parameter"
  exit 1
fi
echo ""

# Download and check headers
echo "3. Downloading ZIP and checking headers..."
HEADERS=$(curl -sI "$DOWNLOAD_URL")
echo "$HEADERS"
echo ""

# Verify Content-Disposition header
echo "4. Verifying Content-Disposition header..."
if echo "$HEADERS" | grep -i "content-disposition" | grep -q "attachment"; then
  echo "   ✓ Content-Disposition header contains 'attachment'"
else
  echo "   ✗ Content-Disposition header missing or invalid"
  exit 1
fi

if echo "$HEADERS" | grep -i "content-disposition" | grep -q ".zip"; then
  echo "   ✓ Content-Disposition header contains '.zip' filename"
else
  echo "   ✗ Content-Disposition header missing filename"
  exit 1
fi

echo ""
echo "=== ✅ All Content-Disposition checks passed! ==="
