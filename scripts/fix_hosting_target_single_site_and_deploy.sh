#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-ai-gatekeeper-ea724}"
SITE_ID="${2:-ai-gatekeeper-app}"   # the site behind https://ai-gatekeeper-app.web.app
TARGET="${3:-landing}"

cd "$HOME/ai-gatekeeper" || exit 1

echo "==> (1) Show current sites"
firebase hosting:sites:list --project "$PROJECT_ID"

echo "==> (2) CLEAR target mapping (landing) so it is linked to ONLY ONE site"
# target:clear often prompts; force-confirm with stdin
printf "y\n" | firebase target:clear hosting "$TARGET" --project "$PROJECT_ID" 2>/dev/null || true

echo "==> (3) Apply target '$TARGET' -> site '$SITE_ID'"
firebase target:apply hosting "$TARGET" "$SITE_ID" --project "$PROJECT_ID" --non-interactive

echo "==> (4) Verify .firebaserc target mapping (should show ONLY '$SITE_ID' under '$TARGET')"
echo "----- .firebaserc -----"
cat .firebaserc
echo "-----------------------"

echo "==> (5) Build frontend -> frontend/dist"
npm --prefix frontend install
npm --prefix frontend run build

echo "==> (6) Deploy ONLY hosting target: $TARGET"
firebase deploy --only "hosting:$TARGET" --project "$PROJECT_ID" --non-interactive

echo "✅ Hosting deployed: target=$TARGET -> site=$SITE_ID"
