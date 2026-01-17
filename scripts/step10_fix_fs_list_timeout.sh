#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Patching FS list to avoid timeouts: $FILE"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

// Replace the specific getFiles call used by FS list handler
// From: const [files] = await bucket.getFiles({ prefix });
// To: paginated, no autopaginate
s = s.replace(
  /const\s+\[files\]\s*=\s*await\s+bucket\.getFiles\(\{\s*prefix\s*\}\);\s*/g,
  `
      const pageTokenRaw = (req && req.query && req.query.pageToken) ? String(req.query.pageToken) : "";
      const pageToken = pageTokenRaw && pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

      // IMPORTANT: avoid auto-pagination so the request can't hang/time out.
      const [files, nextQuery] = await bucket.getFiles({
        prefix,
        maxResults: 200,
        pageToken,
        autoPaginate: false,
      } as any);

      const nextPageToken = (nextQuery && (nextQuery as any).pageToken) ? String((nextQuery as any).pageToken) : null;
  `
);

// Ensure response includes nextPageToken if not already included.
// Find the return res.json({ ok: true, count:..., files: out });
// Replace with one that includes nextPageToken when available.
s = s.replace(
  /return\s+res\.json\(\{\s*ok:\s*true,\s*count:\s*out\.length,\s*files:\s*out\s*\}\);\s*/g,
  `return res.json({ ok: true, count: out.length, files: out, nextPageToken });\n`
);

fs.writeFileSync(file, s, "utf8");
console.log("OK: patched getFiles() to maxResults+no autopaginate + nextPageToken:", file);
NODE

echo "==> Lint + Build + Deploy"
cd "$ROOT/functions" || exit 1
npm run lint -- --fix
npm run build

cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE. Now re-run the curl to /api/baselines/fs"
