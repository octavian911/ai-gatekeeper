#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Patching FS list handler (pagination + timeout + logs): $FILE"

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let s = fs.readFileSync(file, "utf8");

// Find the FS list route and replace only its getFiles call + response, keeping your mapping logic intact.
// We anchor around the prefix + getFiles call you already have.
const anchor = /const prefix = `uploads\/\$\{uid\}\/`;\s*\n\s*\n\s*const \[files\][^;]*;\s*/m;

if (!anchor.test(s)) {
  console.error("ERROR: Couldn't find FS list getFiles anchor (prefix + [files]). Aborting.");
  process.exit(2);
}

const replacement =
`const prefix = \`uploads/\${uid}/\`;

      // Pagination controls (safe defaults)
      const limitRaw = String((req.query && (req.query.limit ?? req.query.maxResults)) ?? "25");
      const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 25, 1), 50);
      const pageToken = (req.query && req.query.pageToken) ? String(req.query.pageToken) : undefined;

      console.log("FS_LIST start", JSON.stringify({ uid, prefix, limit, hasPageToken: !!pageToken }));

      const t0 = Date.now();

      // Hard timeout to prevent Cloud Run 60s upstream timeout
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

      // google-cloud/storage getFiles returns [files, nextQuery, apiResponse]
      const files = result[0] || [];
      const apiResp = result[2] || {};
      const nextPageToken = apiResp.nextPageToken || null;

      const ms = Date.now() - t0;
      console.log("FS_LIST done", JSON.stringify({ uid, count: files.length, nextPageToken: !!nextPageToken, elapsedMs: ms }));
`;

s = s.replace(anchor, replacement);

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
