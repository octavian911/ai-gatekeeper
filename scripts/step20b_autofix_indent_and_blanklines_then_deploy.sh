#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step20b: Auto-fix lint (indent + blank lines) then deploy"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step20b_$ts"
echo "==> Backup: $FILE.bak_step20b_$ts"

# 1) Run eslint --fix on just this file using your deploy config
echo "==> ESLint --fix (index.ts only)"
(
  cd "$ROOT/functions"
  npx eslint --fix --ext .ts . --config .eslintrc.deploy.cjs src/index.ts
)

# 2) Safety: collapse >2 consecutive blank lines to max 2
#    (Some eslint setups won't fix no-multiple-empty-lines depending on rules)
echo "==> Collapse consecutive blank lines to max 2"
awk '
  { if ($0 ~ /^[[:space:]]*$/) { blank++; if (blank <= 2) print $0; next }
    blank=0; print $0
  }
' "$FILE" > "$FILE.step20b.tmp"
mv "$FILE.step20b.tmp" "$FILE"

# 3) Re-run lint/build to confirm clean
echo "==> Lint"
(
  cd "$ROOT/functions"
  npm run lint
)

echo "==> Build"
(
  cd "$ROOT/functions"
  npm run build
)

# 4) Deploy
echo "==> Deploy functions:api"
cd "$ROOT"
firebase deploy --only functions:api

echo "✅ Step20b DONE"
