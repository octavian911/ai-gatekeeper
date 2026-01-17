#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Patching FS list handler (robust): $FILE"

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let s = fs.readFileSync(file, "utf8");

const routeNeedle = 'app.get(["/api/baselines/fs", "/baselines/fs"]';
const i = s.indexOf(routeNeedle);
if (i < 0) {
  console.error("ERROR: Couldn't find FS route declaration:", routeNeedle);
  process.exit(2);
}

// Grab a window that should contain the whole handler (big enough, but not whole file)
const windowStart = i;
const windowEnd = Math.min(s.length, i + 6000);
const chunk = s.slice(windowStart, windowEnd);

// Find the first getFiles assignment inside the route handler
const getFilesRe =
  /const\s*\[(files[^\]]*)\]\s*=\s*await\s+bucket\.getFiles\s*\(\s*\{[\s\S]*?\}\s*\)\s*;\s*/m;

const m = chunk.match(getFilesRe);
if (!m) {
  console.error("ERROR: Couldn't find `const [files...] = await bucket.getFiles({...});` inside FS route block window.");
  process.exit(2);
}

// Replace that line with hardened logic
const hardened =
`// Pagination controls (safe defaults)
      const limitRaw = String((req.query && (req.query.limit ?? req.query.maxResults)) ?? "25");
      const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 25, 1), 50);
      const pageToken = (req.query && req.query.pageToken) ? String(req.query.pageToken) : undefined;

      console.log("FS_LIST start", JSON.stringify({ uid, prefix, limit, hasPageToken: !!pageToken }));

      const t0 = Date.now();

      const listPromise = bucket.getFiles({
        prefix,
        maxResults: limit,
        autoPaginate: false,
        ...(pageToken ? { pageToken } : {}),
      });

      const timeoutMs = 20000;
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error("fs_list_timeout_" + timeoutMs + "ms")), timeoutMs)
      );

      const result = await Promise.race([listPromise, timeoutPromise]);

      const files = (result && result[0]) ? result[0] : [];
      const apiResp = (result && result[2]) ? result[2] : {};
      const nextPageToken = (apiResp && apiResp.nextPageToken) ? apiResp.nextPageToken : null;

      const ms = Date.now() - t0;
      console.log("FS_LIST done", JSON.stringify({ uid, count: (files || []).length, hasNextPageToken: !!nextPageToken, elapsedMs: ms }));
`;

// Apply replace inside the chunk, then stitch back into full file
const newChunk = chunk.replace(getFilesRe, hardened);
s = s.slice(0, windowStart) + newChunk + s.slice(windowEnd);

fs.writeFileSync(file, s);
console.log("OK: FS list route hardened + logging added:", file);
NODE

echo "==> Lint + Build + Deploy functions:api"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
