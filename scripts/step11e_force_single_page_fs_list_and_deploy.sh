#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Patching FS list to force single-page listing (autoPaginate:false): $FILE"

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let s = fs.readFileSync(file, "utf8");

// 1) Force autoPaginate:false in opts
if (!s.includes("autoPaginate: false")) {
  const needle = "const opts: any = { prefix, maxResults: limit };";
  if (!s.includes(needle)) {
    console.error("ERROR: Couldn't find opts line to patch. Search for `maxResults: limit` in FS list route.");
    process.exit(2);
  }
  s = s.replace(
    needle,
    "const opts: any = { prefix, maxResults: limit, autoPaginate: false };"
  );
}

// 2) Make FS_LIST log reliably visible in firebase functions:log (stringify)
s = s.replace(
  /console\.log\("FS_LIST",[^\)]*\);\s*/g,
  'console.log(JSON.stringify({ tag: "FS_LIST", uid, prefix, limit, hasPageToken: !!pageToken, count: out.length, hasNextPageToken: !!nextPageToken, elapsedMs }));\n'
);

s = s.replace(
  /console\.error\("FS_LIST_ERR",[^\)]*\);\s*/g,
  'console.error(JSON.stringify({ tag: "FS_LIST_ERR", message: String(e?.message || e) }));\n'
);

fs.writeFileSync(file, s);
console.log("OK: patched FS list to single-page + log stringify:", file);
NODE

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
