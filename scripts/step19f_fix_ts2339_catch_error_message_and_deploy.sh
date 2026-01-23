#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step19f: Fix TS2339 (e.message on {}) by casting (e as any) in fs_download catches"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step19f_$ts"
echo "==> Backup: $FILE.bak_step19f_$ts"

# IMPORTANT: use @ delimiter because the text contains "||"
sed -i 's@String(e?.message || e)@String((e as any)?.message || e)@g' "$FILE"

echo "==> Sanity: show remaining e?.message occurrences (should be none)"
grep -n "e\?\.[m]essage" "$FILE" || true

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step19f DONE"
