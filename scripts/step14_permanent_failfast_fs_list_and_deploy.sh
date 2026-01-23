#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step14 (PERMANENT): Fail-fast FS list + mount on /api and /baselines"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step14_$ts"
echo "==> Backup: $FILE.bak_step14_$ts"

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let s = fs.readFileSync(file, "utf8");

const startNeedle = 'app.get("/api/baselines/fs"';
const endNeedle1  = 'app.get("/api/baselines/fs_download"';
const endNeedle2  = 'app.get("/baselines/fs_download"';

const a = s.indexOf(startNeedle);
if (a < 0) {
  console.error("ERROR: couldn't find /api/baselines/fs route anchor.");
  process.exit(2);
}

let b = s.indexOf(endNeedle1, a);
if (b < 0) b = s.indexOf(endNeedle2, a);
if (b < 0) {
  console.error("ERROR: couldn't find fs_download route anchor to bound replacement.");
  process.exit(2);
}

const newBlock = `
// ------------------------------------------------------------
// Baselines FS endpoints (GCS-backed) - PERMANENT fail-fast list
// Objects live under: uploads/<uid>/
// ------------------------------------------------------------

const __fsListHandler = (req: any, res: any) => {
  const uid = req.uid as string;
  const t0 = Date.now();

  // Always return JSON (never let Google Frontend generate HTML 504)
  res.setHeader("Cache-Control", "no-store");

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;

  let sent = false;
  const finish = (status: number, payload: any) => {
    if (sent) return;
    sent = true;
    try { return res.status(status).json(payload); } catch { try { res.end(); } catch {} }
  };

  // Hard timeout: respond quickly even if GCS hangs
  const HARD_MS = 8000;
  const timer = setTimeout(() => {
    finish(504, {
      ok: false,
      error: "fs_list_timeout",
      uid,
      prefix,
      limit,
      elapsedMs: Date.now() - t0,
    });
  }, HARD_MS);

  try {
    console.log("[fs] start", { uid, prefix, limit, hasPageToken: !!pageToken, hardMs: HARD_MS });

    // Use the existing @google-cloud/storage client (storage) already in this file
    const bucketName = getUploadBucket();
    const bucket = storage.bucket(bucketName);

    // DO NOT await: attach then/catch; timer guarantees response
    bucket.getFiles({ prefix, maxResults: limit, pageToken, autoPaginate: false })
      .then(([files, , apiResp]: any[]) => {
        clearTimeout(timer);

        const nextPageToken = apiResp?.nextPageToken || null;

        // Keep output minimal (no signed URLs, no extra metadata calls)
        const base = req.path && String(req.path).startsWith("/api/") ? "/api/baselines" : "/baselines";
        const out = (files || []).map((f: any) => ({
          name: f.name,
          downloadUrl: \`\${base}/fs_download?name=\${encodeURIComponent(f.name)}\`,
          size: Number(f.metadata?.size || 0),
          updated: f.metadata?.updated || null,
        }));

        console.log("[fs] done", {
          elapsedMs: Date.now() - t0,
          count: out.length,
          hasNext: !!nextPageToken,
        });

        finish(200, {
          ok: true,
          uid,
          prefix,
          count: out.length,
          files: out,
          nextPageToken,
          elapsedMs: Date.now() - t0,
        });
      })
      .catch((e: any) => {
        clearTimeout(timer);
        console.error("[fs] error", { message: String(e?.message || e) });
        finish(500, {
          ok: false,
          error: "fs_list_failed",
          detail: String(e?.message || e),
          elapsedMs: Date.now() - t0,
        });
      });
  } catch (e: any) {
    clearTimeout(timer);
    console.error("[fs] fatal", { message: String(e?.message || e) });
    finish(500, {
      ok: false,
      error: "fs_list_failed",
      detail: String(e?.message || e),
      elapsedMs: Date.now() - t0,
    });
  }
};

// Mount on BOTH paths (so whichever base URL you hit, it works)
app.get("/api/baselines/fs", requireAuthV2, __fsListHandler);
app.get("/baselines/fs", requireAuthV2, __fsListHandler);

`;

s = s.slice(0, a) + newBlock + s.slice(b);

fs.writeFileSync(file, s, "utf8");
console.log("OK: Replaced /api/baselines/fs block with permanent fail-fast handler + /baselines alias.");
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

echo "✅ Step14 DONE"
