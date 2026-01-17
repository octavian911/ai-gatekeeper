#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
[ -f "$FILE" ] || { echo "ERROR: missing $FILE"; exit 2; }

echo "==> Patching $FILE to ensure /baselines/fs uses requireAuthV2 + add /baselines/fs_debug"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

// 1) Force requireAuthV2 middleware on GET/POST /baselines/fs (only if not already present)
function forceMiddleware(routePath) {
  const re = new RegExp(`(\\.(get|post)\\(\\s*["']${routePath}["']\\s*,\\s*)(?!requireAuthV2\\s*,)`, "g");
  s = s.replace(re, `$1requireAuthV2, `);
}
forceMiddleware("/baselines/fs");
forceMiddleware("/baselines/fs_debug");

// 2) Add a safe debug endpoint if missing.
//    (Does NOT echo token; only reports meta + whether auth header existed.)
if (!s.includes('"/baselines/fs_debug"')) {
  const insertAfter = s.indexOf('"/baselines/fs"');
  if (insertAfter === -1) {
    console.error("ERROR: Could not find /baselines/fs route in index.ts. Patch aborted.");
    process.exit(3);
  }

  const debugRoute = `
  // DEBUG: verify auth + show safe token metadata (no token leakage)
  .get("/baselines/fs_debug", requireAuthV2, async (req: any, res: any) => {
    const h = String((req && req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
    const tok = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
    const dots = (tok.match(/\\./g) || []).length;
    res.json({
      ok: true,
      uid: req.uid || null,
      authHeaderPresent: !!h,
      tokenLen: tok.length,
      tokenDots: dots,
      tokenHead: tok ? tok.slice(0, 12) : null,
      tokenTail: tok ? tok.slice(-12) : null
    });
  })
`;

  // Insert debug route right after the fs route definition line chunk (best-effort)
  // We insert after the first occurrence of /baselines/fs route start.
  const pos = s.indexOf('.get("/baselines/fs"');
  if (pos === -1) {
    console.error("ERROR: Could not find .get(\"/baselines/fs\" in index.ts. Patch aborted.");
    process.exit(4);
  }

  // Insert after the fs route block end would be ideal, but we don't parse AST here.
  // Instead: insert debug route immediately before the NEXT route definition after /baselines/fs if possible.
  // Fallback: append near the end of the router chain.
  const nextRoutePos = s.indexOf('.get("', pos + 1);
  const insertPos = nextRoutePos !== -1 ? nextRoutePos : s.length - 1;

  s = s.slice(0, insertPos) + debugRoute + "\n" + s.slice(insertPos);
}

fs.writeFileSync(file, s, "utf8");
console.log("OK: patched /baselines/fs middleware + ensured /baselines/fs_debug exists:", file);
NODE

echo "==> Lint + Build"
cd "$ROOT/functions"
npm run lint -- --fix
npm run build

echo "==> Deploy functions:api"
cd "$ROOT"
firebase deploy --only functions:api

echo "✅ DONE"
