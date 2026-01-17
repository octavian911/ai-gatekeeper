#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Patching UID propagation + FS handlers in: $FILE"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

// ------------------------------------------------------------
// 1) Ensure requireAuthV2 sets BOTH req.uid and req.user.uid
//    and attaches signInProvider for debugging.
// ------------------------------------------------------------

// Add a compatibility assignment right after "req.uid = uid" inside requireAuthV2
// (Safe even if requireAuthV2 is moved around; if it doesn't find the anchor, we fail loudly.)
const anchor = /(\breq\.uid\s*=\s*uid\s*;\s*)/;
if (!anchor.test(s)) {
  console.error("ERROR: Couldn't find `req.uid = uid;` anchor. Aborting.");
  process.exit(2);
}

s = s.replace(anchor, `$1
    // Back-compat for older handlers still reading req.user.uid
    (req as any).user = { uid };
    // Helpful debug info (anonymous, password, etc.)
    (req as any).signInProvider = (decoded && decoded.firebase && decoded.firebase.sign_in_provider) ? decoded.firebase.sign_in_provider : null;
`);

// ------------------------------------------------------------
// 2) Fix FS list route to read uid from req.uid first
// ------------------------------------------------------------
s = s.replace(
  /const uid = \(req as any\)\?\.\s*user\?\.\s*uid\s*;/g,
  'const uid = (req as any)?.uid || (req as any)?.user?.uid;'
);

// ------------------------------------------------------------
// 3) Fix FS delete route: use requireAuthV2 + uid from req.uid
// ------------------------------------------------------------
s = s.replace(
  /app\.delete\(\(\[\s*"\/api\/baselines\/:screenId\/fs",\s*"\/baselines\/:screenId\/fs"\s*\]\),\s*requireAuth,\s*async\s*\(req:\s*any,\s*res:\s*any\)\s*=>/g,
  'app.delete(["/api/baselines/:screenId/fs", "/baselines/:screenId/fs"], requireAuthV2, async (req: any, res: any) =>'
);

s = s.replace(
  /const uid = \(req as any\)\?\.\s*user\?\.\s*uid\s*;/g,
  'const uid = (req as any)?.uid || (req as any)?.user?.uid;'
);

// Write back
fs.writeFileSync(file, s, "utf8");
console.log("OK: patched requireAuthV2 + FS uid reads + FS delete middleware");
NODE

echo "==> Lint + Build + Deploy functions:api"
cd "$ROOT/functions" || exit 1
npm run lint -- --fix
npm run build

cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
