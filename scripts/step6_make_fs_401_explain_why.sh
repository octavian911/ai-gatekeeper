#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Patching $FILE to make /baselines/fs include a denial reason (safe)"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

// 1) Ensure requireAuthV2 attaches provider info (safe fields only)
if (!s.includes("req.signInProvider")) {
  s = s.replace(
    /req\.uid\s*=\s*decoded\.uid\s*;\s*/,
    match => match + `req.signInProvider = (decoded && decoded.firebase && decoded.firebase.sign_in_provider) ? decoded.firebase.sign_in_provider : null;\n`
  );
}

// 2) In /baselines/fs handler, replace bare unauthorized with detailed one (best-effort).
// We look for the first occurrence of the fs route and then replace `res.status(401).json({ ok: false, error: "unauthorized" })`
// with an expanded payload including uid + provider.
const fsRouteIdx = s.indexOf('"/baselines/fs"');
if (fsRouteIdx === -1) {
  console.error("ERROR: cannot find /baselines/fs in index.ts");
  process.exit(2);
}

const before = s.slice(0, fsRouteIdx);
const after = s.slice(fsRouteIdx);

// Replace the first bare unauthorized in the portion AFTER the fs route definition begins
const replaced = after.replace(
  /res\.status\(401\)\.json\(\{\s*ok:\s*false\s*,\s*error:\s*["']unauthorized["']\s*\}\)\s*;?/,
  `res.status(401).json({ ok:false, error:"unauthorized", reason:"fs_handler_denied", uid:req.uid||null, provider:(req as any).signInProvider||null });`
);

s = before + replaced;

fs.writeFileSync(file, s, "utf8");
console.log("OK: patched requireAuthV2 provider + fs 401 detail:", file);
NODE

echo "==> Lint + Build + Deploy"
cd "$ROOT/functions"
npm run lint -- --fix
npm run build
cd "$ROOT"
firebase deploy --only functions:api

echo "✅ DONE"
