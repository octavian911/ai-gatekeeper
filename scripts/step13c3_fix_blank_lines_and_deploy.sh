#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

echo "==> Step13c3: Fix no-multiple-empty-lines + deploy"
echo "    Target: $FILE"

cd "$ROOT/functions" || exit 1

echo "==> ESLint auto-fix (only index.ts)"
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix

echo "==> Lint"
npm run lint

echo "==> Build"
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "==> DONE"
