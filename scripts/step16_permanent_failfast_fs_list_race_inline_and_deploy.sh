#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step16 (PERMANENT): Make /api/baselines/fs + /baselines/fs fail-fast via Promise.race timeout"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step16_$ts"
echo "==> Backup: $FILE.bak_step16_$ts"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

function replaceRoute(path) {
  // Replace app.get("path", requireAuthV2, async (...) => { ... });  (DOTALL)
  const re = new RegExp(
    String.raw`app\.get\(\s*["']` + path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + String.raw`["']\s*,\s*requireAuthV2\s*,\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\}\);\s*`,
    "m"
  );

  const handler =
`app.get("${path}", requireAuthV2, async (req: any, res: any) => {
  const uid = req.uid as string;

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;

  // HARD fail-fast so Cloud Run never hits 60s upstream timeout
  const TIMEOUT_MS = 8000;

  try {
    const bucket = storage.bucket(getUploadBucket());

    const listPromise = bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken,
      autoPaginate: false,
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("fs_list_timeout")), TIMEOUT_MS);
    });

    const result: any = await Promise.race([listPromise, timeoutPromise]);

    const files = (result && result[0]) ? result[0] : [];
    const apiResp = (result && result[2]) ? result[2] : {};
    const nextPageToken = (apiResp as any)?.nextPageToken || null;

    const out = (files || []).map((f: any) => ({
      name: f.name,
      size: Number(f.metadata?.size || 0),
      updated: f.metadata?.updated || null,
      downloadUrl: \`/baselines/fs_download?name=\${encodeURIComponent(f.name)}\`,
    }));

    return res.json({
      ok: true,
      uid,
      prefix,
      count: out.length,
      files: out,
      nextPageToken,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "fs_list_timeout") {
      return res.status(504).json({
        ok: false,
        error: "fs_list_timeout",
        timeoutMs: TIMEOUT_MS,
      });
    }
    console.error("[fs] error", { message: msg });
    return res.status(500).json({ ok: false, error: "fs_list_failed", detail: msg });
  }
});\n`;

  if (re.test(s)) {
    s = s.replace(re, handler);
    return true;
  }
  return false;
}

// 1) Replace /api/baselines/fs (must exist)
if (!replaceRoute("/api/baselines/fs")) {
  console.error("ERROR: Could not find existing route app.get(\"/api/baselines/fs\", ...). Aborting.");
  process.exit(1);
}

// 2) Ensure /baselines/fs exists with same handler (replace if exists, else insert right after /api handler)
const baselinesExists = replaceRoute("/baselines/fs");
if (!baselinesExists) {
  // Insert after the /api/baselines/fs handler we just wrote
  const anchor = `app.get("/api/baselines/fs", requireAuthV2, async (req: any, res: any) => {`;
  const idx = s.indexOf(anchor);
  if (idx < 0) {
    console.error("ERROR: Anchor not found after replacement. Aborting.");
    process.exit(1);
  }
  // Find end of that handler (first occurrence of "});" after idx)
  const endIdx = s.indexOf("});", idx);
  if (endIdx < 0) {
    console.error("ERROR: Could not find end of /api/baselines/fs handler. Aborting.");
    process.exit(1);
  }
  const insertAt = endIdx + 3;
  const baselinesHandler = "\n\n" + s.match(new RegExp(String.raw`app\.get$begin:math:text$\\s\*\[\"\'\]\/api\/baselines\/fs\[\"\'\]\[\\s\\S\]\*\?\\n\\\}$end:math:text$;\s*`, "m"))[0]
    .replace(/\/api\/baselines\/fs/g, "/baselines/fs");
  s = s.slice(0, insertAt) + baselinesHandler + s.slice(insertAt);
}

// Tidy very long blank gaps (eslint will finalize)
s = s.replace(/\n{5,}/g, "\n\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("OK: /api/baselines/fs replaced + /baselines/fs ensured (fail-fast timeout).");
NODE

echo "==> ESLint auto-fix index.ts"
cd "$ROOT/functions" || exit 1
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step16 DONE"
echo "Next: run your strict test script again."
