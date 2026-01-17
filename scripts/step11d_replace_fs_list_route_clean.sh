#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Replacing FS list route with a clean handler: $FILE"

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let s = fs.readFileSync(file, "utf8");

const startNeedle = 'app.get(["/api/baselines/fs", "/baselines/fs"], requireAuthV2';
const start = s.indexOf(startNeedle);
if (start < 0) {
  console.error("ERROR: Couldn't find FS list route start anchor.");
  process.exit(2);
}

// Find the opening brace of the handler
const braceOpen = s.indexOf("{", start);
if (braceOpen < 0) {
  console.error("ERROR: Couldn't find opening '{' for FS list route.");
  process.exit(2);
}

// Walk forward to find the matching closing brace for the handler function body
let i = braceOpen;
let depth = 0;
for (; i < s.length; i++) {
  const ch = s[i];
  if (ch === "{") depth++;
  else if (ch === "}") depth--;
  if (depth === 0) break;
}
if (depth !== 0) {
  console.error("ERROR: Unbalanced braces while locating FS list route end.");
  process.exit(2);
}

// After matching '}', we expect ');' to close app.get(...);
const after = s.slice(i, i + 10);
const closeIdx = s.indexOf(");", i);
if (closeIdx < 0) {
  console.error("ERROR: Couldn't find route closing ');' after handler.");
  process.exit(2);
}
const end = closeIdx + 2;

// Build replacement block
const replacement = `
  // List files for current user
  app.get(["/api/baselines/fs", "/baselines/fs"], requireAuthV2, async (req: any, res: any) => {
    const startedAt = Date.now();

    try {
      const uid = (req as any)?.uid || (req as any)?.user?.uid;
      if (!uid) {
        return res.status(401).json({
          ok: false,
          error: "unauthorized",
          reason: "fs_handler_denied",
          uid: (req as any)?.uid || null,
          provider: (req as any).signInProvider || null,
        });
      }

      const bucket = admin.storage().bucket(getUploadBucket());
      const prefix = \`uploads/\${uid}/\`;

      // Query controls
      const limitRaw = (req.query as any)?.limit;
      const limitNum = Number(limitRaw);
      const limit = Number.isFinite(limitNum) ? Math.min(Math.max(limitNum, 1), 200) : 50;

      const pageTokenRaw = (req.query as any)?.pageToken;
      const pageTokenStr = pageTokenRaw ? String(pageTokenRaw).trim() : "";
      const pageToken = pageTokenStr ? pageTokenStr : undefined;

      const opts: any = { prefix, maxResults: limit };
      if (pageToken) opts.pageToken = pageToken;

      // @google-cloud/storage getFiles returns: [files, nextQuery, apiResponse]
      const result: any = await bucket.getFiles(opts);
      const files: any[] = (result && result[0]) ? result[0] : [];
      const nextQuery: any = (result && result[1]) ? result[1] : null;
      const nextPageToken: string | undefined =
        nextQuery && nextQuery.pageToken ? String(nextQuery.pageToken) : undefined;

      const out = (files || [])
        .filter((f: any) => f?.name && !String(f.name).endsWith("/"))
        .map((f: any) => {
          const object = String(f.name);
          const filename = object.startsWith(prefix) ? object.slice(prefix.length) : object;
          return {
            object,
            filename,
            downloadPath: \`/api/download?object=\${encodeURIComponent(object)}\`,
          };
        });

      const elapsedMs = Date.now() - startedAt;
      console.log("FS_LIST", { uid, prefix, limit, hasPageToken: !!pageToken, count: out.length, hasNextPageToken: !!nextPageToken, elapsedMs });

      return res.json({ ok: true, count: out.length, files: out, nextPageToken });
    } catch (e: any) {
      console.error("FS_LIST_ERR", { message: String(e?.message || e) });
      return res.status(500).json({ ok: false, error: "list_failed", message: String(e?.message || e) });
    }
  });
`.trimStart();

// Replace original route block
s = s.slice(0, start) + replacement + s.slice(end);

fs.writeFileSync(file, s);
console.log("OK: FS list route replaced cleanly:", file);
NODE

echo "==> Auto-fix formatting + lint + build"
cd "$ROOT/functions" || exit 1
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
