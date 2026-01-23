#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step12: Replace /api/baselines/fs with fast single-page list + add /fs_download proxy (no signed URLs)"
echo "    Target: $FILE"

# Safety backup
cp -a "$FILE" "$FILE.bak.$(date +%s)"

node <<'NODE'
const fs = require("fs");

const FILE = process.env.FILE || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let src = fs.readFileSync(FILE, "utf8");

function ensurePathImport(s) {
  // If already present, do nothing.
  if (s.includes('from "path"') || s.includes("from 'path'")) return s;

  // Insert after the last import line at the top.
  const lines = s.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 200); i++) {
    if (/^\s*import\s.+from\s+['"].+['"]\s*;?\s*$/.test(lines[i])) lastImportIdx = i;
    // Stop scanning once we hit non-import code after imports
    if (lastImportIdx !== -1 && i > lastImportIdx && /^\s*(const|let|var|function|app\.|\/\/|\/\*|\*|\s*$)/.test(lines[i])) {
      // keep going a bit; but don't overthink
    }
  }
  if (lastImportIdx === -1) return s; // don't guess if the file isn't ESM-style
  lines.splice(lastImportIdx + 1, 0, 'import * as path from "path";');
  return lines.join("\n");
}

function findRouteBlock(s, routePath) {
  const needle = routePath;
  const idx = s.indexOf(needle);
  if (idx === -1) return null;

  // Find the nearest "app.get(" before the route string
  const start = s.lastIndexOf("app.get", idx);
  if (start === -1) return null;

  // Find the first "{" after start (handler body)
  const braceStart = s.indexOf("{", start);
  if (braceStart === -1) return null;

  // Brace-match to end of handler function body
  let depth = 0;
  let i = braceStart;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++; // include this closing brace
        break;
      }
    }
  }
  if (depth !== 0) return null;

  // Now find the closing ");" for app.get(...);
  let end = s.indexOf(");", i);
  if (end === -1) return null;
  end += 2;

  // Include trailing newline if present
  if (s[end] === "\n") end += 1;

  return { start, end };
}

function insertAfter(s, anchorEndIndex, text) {
  return s.slice(0, anchorEndIndex) + text + s.slice(anchorEndIndex);
}

src = ensurePathImport(src);

const listBlock = findRouteBlock(src, '"/api/baselines/fs"') || findRouteBlock(src, "'/api/baselines/fs'");
if (!listBlock) {
  console.error("ERROR: Could not find app.get('/api/baselines/fs' ...) block to replace.");
  process.exit(1);
}

// Build a clean list route (NO signed URLs, no deep metadata calls)
const newListRoute = `
app.get("/api/baselines/fs", requireAuthV2, async (req: any, res: any) => {
  const uid = req.uid as string;
  const t0 = Date.now();

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;

  try {
    console.log("[fs] start", { uid, prefix, limit, hasPageToken: !!pageToken });

    const bucketName = getUploadBucket();
    console.log("[fs] bucket", { bucketName });

    const bucket = admin.storage().bucket(bucketName);

    const [files, , apiResp] = await bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken,
      autoPaginate: false,
    });

    const nextPageToken = (apiResp as any)?.nextPageToken;

    const out = (files || []).map((f: any) => ({
      name: f.name,
      size: Number(f.metadata?.size || 0),
      updated: f.metadata?.updated || null,
      downloadUrl: \`/api/baselines/fs_download?name=\${encodeURIComponent(f.name)}\`,
    }));

    console.log("[fs] done", {
      elapsedMs: Date.now() - t0,
      count: out.length,
      hasNext: !!nextPageToken,
    });

    return res.json({
      ok: true,
      uid,
      prefix,
      count: out.length,
      files: out,
      nextPageToken: nextPageToken || null,
      elapsedMs: Date.now() - t0,
    });
  } catch (e: any) {
    console.error("[fs] error", { message: String(e?.message || e) });
    return res.status(500).json({ ok: false, error: "fs_list_failed", detail: String(e?.message || e) });
  }
});
`.trim() + "\n";

// Download proxy route (avoids signed URLs; streams file through function)
const downloadRoute = `
app.get("/api/baselines/fs_download", requireAuthV2, async (req: any, res: any) => {
  const uid = req.uid as string;
  const name = req.query?.name ? String(req.query.name) : "";

  const expectedPrefix = \`uploads/\${uid}/\`;
  if (!name || !name.startsWith(expectedPrefix)) {
    return res.status(403).json({ ok: false, error: "forbidden", detail: "Invalid file path." });
  }

  try {
    const bucket = admin.storage().bucket(getUploadBucket());
    const file = bucket.file(name);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", \`attachment; filename="\${path.basename(name)}"\`);

    file
      .createReadStream()
      .on("error", (err: any) => {
        console.error("[fs_download] stream error", { message: String(err?.message || err) });
        if (!res.headersSent) res.status(500).end("download failed");
        else res.end();
      })
      .pipe(res);
  } catch (e: any) {
    console.error("[fs_download] error", { message: String(e?.message || e) });
    return res.status(500).json({ ok: false, error: "download_failed", detail: String(e?.message || e) });
  }
});
`.trim() + "\n";

// Replace the existing /fs route block with the new clean one
src = src.slice(0, listBlock.start) + newListRoute + src.slice(listBlock.end);

// Ensure download route exists; if not, insert immediately after the list route we just wrote
const hasDownload =
  src.includes('app.get("/api/baselines/fs_download"') ||
  src.includes("app.get('/api/baselines/fs_download'");

if (!hasDownload) {
  // Insert after the new list route we inserted (find its end by searching for it)
  const insertAt = src.indexOf(newListRoute) + newListRoute.length;
  src = insertAfter(src, insertAt, "\n" + downloadRoute + "\n");
}

// Final sanity: must still have the list route
if (!src.includes('app.get("/api/baselines/fs"')) {
  console.error("ERROR: After patch, /api/baselines/fs route missing.");
  process.exit(1);
}

fs.writeFileSync(FILE, src, "utf8");
console.log("OK: Replaced /api/baselines/fs and ensured /api/baselines/fs_download exists.");
NODE
echo "==> Formatting + lint + build"
cd "$ROOT/functions" || exit 1
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step12 DONE."
echo "Next test (paste your JWT first):"
echo '  curl -sS -i -H "Authorization: Bearer $JWT" "https://api-cbkg2trx7q-uc.a.run.app/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
