#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step19e: Fix no-multiple-empty-lines in index.ts, then lint/build/deploy"
echo "    Target: $FILE"

if [ ! -f "$FILE" ]; then
  echo "ERROR: missing $FILE" >&2
  exit 1
fi

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step19e_$ts"
echo "==> Backup: $FILE.bak_step19e_$ts"

echo "==> Collapsing consecutive blank lines to max 2 (no-multiple-empty-lines)"
tmp="$(mktemp)"

awk '
  # Treat lines that are empty or whitespace-only as blank
  function isblank(s) { return (s ~ /^[[:space:]]*$/) }

  {
    if (isblank($0)) {
      blank++
      if (blank <= 2) print $0
      next
    }
    blank = 0
    print $0
  }
' "$FILE" > "$tmp"

mv "$tmp" "$FILE"

echo "==> Sanity: show offending areas (approx lines)"
# Just a helpful peek around the previous line numbers; ok if they shifted
nl -ba "$FILE" | sed -n '930,960p' || true
nl -ba "$FILE" | sed -n '1035,1060p' || true
nl -ba "$FILE" | sed -n '1105,1135p' || true

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step19e DONE"
