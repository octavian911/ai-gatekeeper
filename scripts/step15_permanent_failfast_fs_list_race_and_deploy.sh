#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step15 (PERMANENT): Make /baselines/fs and /api/baselines/fs fail-fast (Promise.race timeout)"
echo "    Target: $FILE"

# Backup
ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step15_$ts"
echo "==> Backup: $FILE.bak_step15_$ts"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

const startNeedle = 'app.get("/api/baselines/fs", requireAuthV2';
const dlNeedle = 'app.get("/api/baselines/fs_download", requireAuthV2';

const i0 = s.indexOf(startNeedle);
const i1 = s.indexOf(dlNeedle);

if (i0 < 0) {
  console.error("ERROR: Couldn't find /api/baselines/fs route start.");
  process.exit(1);
}
if (i1 < 0 || i1 <= i0) {
  console.error("ERROR: Couldn't find /api/baselines/fs_download anchor after fs route.");
  process.exit(1);
}

// Replace everything from fs route start up to (but not including) fs_download route
const before = s.slice(0, i0);
const after = s.slice(i1);

const replacement = `
// ===== FS list (fail-fast) =====
const handleFsList = async (req: any, res: any) => {
  const uid = req.uid as string;
  const t0 = Date.now();

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;
  const bucketName = getUploadBucket();
  const timeoutMs = 4000; // hard fail-fast (must be << 60s upstream)

  try {
    console.log("[fs] start", { uid, prefix, limit, hasPageToken: !!pageToken, bucketName, timeoutMs });

    const bucket = admin.storage().bucket(bucketName);

    const listPromise = bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken,
      autoPaginate: false,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("FS_LIST_TIMEOUT")), timeoutMs)
    );

    const result: any = await Promise.race([listPromise as any, timeoutPromise]);

    const files = (result && result[0]) ? result[0] : [];
    const apiResp = (result && result[2]) ? result[2] : {};
    const nextPageToken = (apiResp as any)?.nextPageToken || null;

    const out = (files || []).map((f: any) => ({
      name: f.name,
      size: Number(f.metadata?.size || 0),
      updated: f.metadata?.updated || null,
      // normalize to /baselines so frontend can call either base path
      downloadUrl: \`/baselines/fs_download?name=\${encodeURIComponent(f.name)}\`,
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
      nextPageToken,
      elapsedMs: Date.now() - t0,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);

    if (msg.includes("FS_LIST_TIMEOUT")) {
      console.warn("[fs] timeout", { elapsedMs: Date.now() - t0, timeoutMs, uid, prefix });
      return res.status(504).json({
        ok: false,
        error: "fs_list_timeout",
        timeoutMs,
        uid,
        prefix,
      });
    }

    console.error("[fs] error", { message: msg });
    return res.status(500).json({
      ok: false,
      error: "fs_list_failed",
      detail: msg,
    });
  }
};

// Mount on both paths
app.get("/api/baselines/fs", requireAuthV2, handleFsList);
app.get("/baselines/fs", requireAuthV2, handleFsList);

// ==============================
`;

s = before + replacement + after;
fs.writeFileSync(file, s, "utf8");
console.log("OK: Replaced /api/baselines/fs with fail-fast handler + mounted /baselines/fs.");
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

echo "✅ Step15 DONE"
