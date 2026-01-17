#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Fixing TypeScript error (AuthedReq missing signInProvider) in: $FILE"

node <<'NODE'
const fs = require("fs");
const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

// Replace only the assignment we introduced
s = s.replace(
  /\breq\.signInProvider\s*=\s*/g,
  "(req as any).signInProvider = "
);

fs.writeFileSync(file, s, "utf8");
console.log("OK: patched req.signInProvider -> (req as any).signInProvider");
NODE

echo "==> Lint + Build + Deploy functions:api"
cd "$ROOT/functions"
npm run lint -- --fix
npm run build
cd "$ROOT"
firebase deploy --only functions:api

echo "✅ DONE"
