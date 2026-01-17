#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
cd "$ROOT/functions" || exit 1

echo "==> Auto-fixing eslint issues in src/index.ts"
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix

echo "==> Lint (should pass now)"
npm run lint

echo "==> Build"
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
