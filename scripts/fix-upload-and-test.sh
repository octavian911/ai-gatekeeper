#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> 1) Patch frontend: remove accidental double /api prefix"
# Fix any literal /api/api occurrences
if command -v rg >/dev/null 2>&1; then
  HITS="$(rg -n "/api/api" frontend 2>/dev/null || true)"
  if [ -n "$HITS" ]; then
    echo "$HITS"
    FILES="$(rg -l "/api/api" frontend 2>/dev/null || true)"
    if [ -n "$FILES" ]; then
      # Replace /api/api -> /api
      echo "$FILES" | xargs -I{} perl -pi -e 's#/api/api#\/api#g' "{}"
      echo "Patched /api/api -> /api in frontend files."
    fi
  else
    echo "No /api/api string found in frontend (good)."
  fi
else
  echo "rg not found; skipping search/replace. Install ripgrep or manually fix /api/api."
fi

echo "==> 2) Ensure frontend has ONE base and endpoints don't re-add /api"
# If you use Vite env vars, standardize to VITE_API_BASE=/api
# This doesn't break anything even if unused.
if [ ! -f frontend/.env.production ]; then
  cat > frontend/.env.production <<'ENV'
VITE_API_BASE=/api
ENV
  echo "Created frontend/.env.production with VITE_API_BASE=/api"
else
  if ! grep -q '^VITE_API_BASE=' frontend/.env.production; then
    echo 'VITE_API_BASE=/api' >> frontend/.env.production
    echo "Added VITE_API_BASE=/api to frontend/.env.production"
  fi
fi

echo "==> 3) Create a real test file path (no more curl (26))"
TEST_IMG=""
for f in ./tmp/login.png ./tmp/dashboard.png ./tmp/pricing.png ./tests/fixtures/test-image-1.png; do
  if [ -f "$f" ]; then TEST_IMG="$f"; break; fi
done

if [ -z "$TEST_IMG" ]; then
  mkdir -p /tmp/ai-gatekeeper
  # Create a tiny file; image not required just to test multipart plumbing
  echo "hello" > /tmp/ai-gatekeeper/test.txt
  TEST_IMG="/tmp/ai-gatekeeper/test.txt"
fi
echo "Using file: $TEST_IMG"

echo "==> 4) Smoke-test endpoint wiring (won't exit your terminal if JWT missing)"
if [ -z "${JWT:-}" ]; then
  echo ""
  echo "JWT is NOT set in this terminal session."
  echo "Do this in your browser console (while logged into the app):"
  echo "  await firebase.auth().currentUser.getIdToken()"
  echo "Then in this terminal:"
  echo "  export JWT='PASTE_TOKEN_HERE'"
  echo ""
  echo "After exporting JWT, re-run:"
  echo "  bash scripts/fix-upload-and-test.sh"
  exit 0
fi

echo "JWT looks set: ${JWT:0:16}..."

echo "==> 5) Verify token reaches backend"
curl -sS -i -H "Authorization: Bearer $JWT" \
  "https://app.ai-gatekeeper.ca/api/__debug/verify?t=$(date +%s)" | head -n 40

echo ""
echo "==> 6) Upload multipart to the REAL upload endpoint (single /api)"
curl -sS -i \
  -H "Authorization: Bearer $JWT" \
  -F "files=@${TEST_IMG}" \
  -F 'meta={"screenId":"Test","route":"/test","viewportW":800,"viewportH":600};type=application/json' \
  "https://app.ai-gatekeeper.ca/api/baselines/upload-multi-fs" | head -n 120

echo ""
echo "Done."
