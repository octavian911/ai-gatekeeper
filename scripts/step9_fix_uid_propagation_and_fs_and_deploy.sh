#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Fixing UID propagation + FS handler UID source in: $FILE"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

function fail(msg) {
  console.error("ERROR:", msg);
  process.exit(2);
}

// 1) Ensure requireAuthV2 sets BOTH req.uid and req.user.uid
// We patch inside requireAuthV2 by injecting after we compute uid from decoded token.
const reRequireAuthV2 = /async function requireAuthV2\s*\([\s\S]*?\n}\n/;
const m = s.match(reRequireAuthV2);
if (!m) fail("requireAuthV2() block not found.");

let block = m[0];

// Try to inject right after: const uid = decoded.uid;
if (block.includes("const uid = decoded.uid") && !block.includes("(req as any).user") ) {
  block = block.replace(
    /const uid = decoded\.uid;\s*\n/,
    `const uid = decoded.uid;\n    // Propagate UID consistently for downstream handlers\n    (req as any).uid = uid;\n    (req as any).user = { uid };\n`
  );
}

// If it already sets req.uid but not req.user, add req.user next to it
if (block.includes("(req as any).uid") && !block.includes("(req as any).user")) {
  block = block.replace(
    /(req as any)\.uid\s*=\s*uid;\s*\n/,
    `(req as any).uid = uid;\n    (req as any).user = { uid };\n`
  );
}

// If neither pattern matched, try a broader injection before next()
if (!block.includes("(req as any).user")) {
  if (block.includes("next();")) {
    block = block.replace(
      /(\s*)next\(\);\s*\n/,
      `$1// Propagate UID consistently for downstream handlers\n$1(req as any).uid = (req as any).uid || (req as any).user?.uid;\n$1(req as any).user = (req as any).user || { uid: (req as any).uid };\n$1next();\n`
    );
  } else {
    fail("Couldn't find a safe injection point in requireAuthV2 (no 'const uid = decoded.uid' or 'next();').");
  }
}

s = s.replace(reRequireAuthV2, block);

// 2) Patch FS list handler to read uid from req.uid OR req.user.uid
// Replace: const uid = (req as any)?.user?.uid;
s = s.replace(
  /const uid\s*=\s*\(req as any\)\?\.\s*user\?\.\s*uid;\s*\n/g,
  "const uid = (req as any)?.uid || (req as any)?.user?.uid;\n"
);

// Also patch any other common variant:
s = s.replace(
  /const uid\s*=\s*\(req as any\)\?\.\s*user\?\.\s*uid\s*;\s*\n/g,
  "const uid = (req as any)?.uid || (req as any)?.user?.uid;\n"
);

fs.writeFileSync(file, s, "utf8");
console.log("OK: Patched requireAuthV2 UID propagation + FS uid source:", file);
NODE

echo "==> Lint + Build + Deploy functions:api"
cd "$ROOT/functions" || exit 1
npm run lint -- --fix
npm run build

cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
