#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILEPATH="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step13c (PERMANENT): Add non-/api aliases for fs + fs_download"
echo "    Target: $FILEPATH"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILEPATH" "$FILEPATH.bak_step13c_$ts"
echo "==> Backup: $FILEPATH.bak_step13c_$ts"

FILE="$FILEPATH" node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
if (!file) { console.error("Missing FILE env"); process.exit(2); }

let src = fs.readFileSync(file, "utf8");

// We will replace BOTH route blocks:
// - app.get("/api/baselines/fs"...)
// - app.get("/api/baselines/fs_download"...)
// with a shared handler mounted on BOTH /api/... and /...

const reFs = /app\.get\(\s*["']\/api\/baselines\/fs["']\s*,[\s\S]*?\n\}\);\n/s;
const reDl = /app\.get\(\s*["']\/api\/baselines\/fs_download["']\s*,[\s\S]*?\n\}\);\n/s;

if (!reFs.test(src)) {
  console.error('ERROR: could not find app.get("/api/baselines/fs" ...) block');
  process.exit(2);
}
if (!reDl.test(src)) {
  console.error('ERROR: could not find app.get("/api/baselines/fs_download" ...) block');
  process.exit(2);
}

// Remove existing blocks first (so we don't duplicate)
src = src.replace(reFs, "");
src = src.replace(reDl, "");

// Insert a clean shared implementation near where the old fs route used to be.
// We'll insert right before the comment "Baselines FS endpoints" if present; otherwise append near end.
const anchor = "/**\n * Baselines FS endpoints (GCS-backed)";
const insertAt = src.indexOf(anchor);

const block = `
/**
 * Baselines FS endpoints (GCS-backed)
 * Objects live under: uploads/<uid>/
 *
 * NOTE: Some deployments effectively strip "/api" before Express routing.
 * So we mount BOTH:
 *   /api/baselines/*  and  /baselines/*
 */

async function baselinesFsListHandler(req: any, res: any) {
  const uid = req.uid as string;
  const t0 = Date.now();

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;

  // Fail fast: never let platform-level 60s timeouts happen.
  const HARD_TIMEOUT_MS = 12000;

  function timeoutPromise(ms: number) {
    return new Promise((_, reject) => {
      const err: any = new Error("fs_list_timeout");
      err.code = "FS_LIST_TIMEOUT";
      setTimeout(() => reject(err), ms);
    });
  }

  try {
    console.log("[fs] start", { uid, prefix, limit, hasPageToken: !!pageToken });

    const bucketName = getUploadBucket();
    const bucket = storage.bucket(bucketName);

    const p = bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken,
      autoPaginate: false,
    });

    const result: any = await Promise.race([p, timeoutPromise(HARD_TIMEOUT_MS)]);
    const files = (result && result[0]) ? result[0] : [];
    const apiResp = (result && result[2]) ? result[2] : {};
    const nextPageToken = apiResp?.nextPageToken || null;

    // Minimal output: no metadata fetches, no signed URLs
    const out = (files || []).map((f: any) => ({
      name: f.name,
      // IMPORTANT: use the NON-/api download path to work in both routing modes.
      // We also mount /api/baselines/fs_download, so either will resolve.
      downloadUrl: \`/baselines/fs_download?name=\${encodeURIComponent(f.name)}\`,
    }));

    console.log("[fs] done", {
      elapsedMs: Date.now() - t0,
      count: out.length,
      hasNext: !!nextPageToken,
    });

    res.setHeader("Cache-Control", "no-store");
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
    const code = String(e?.code || "");
    console.error("[fs] error", { code, message: msg });

    if (code === "FS_LIST_TIMEOUT" || msg.includes("fs_list_timeout")) {
      return res.status(504).json({
        ok: false,
        error: "fs_list_timeout",
        detail: "Listing files exceeded 12s. Likely bucket/client/egress issue.",
      });
    }

    return res.status(500).json({
      ok: false,
      error: "fs_list_failed",
      detail: msg,
    });
  }
}

async function baselinesFsDownloadHandler(req: any, res: any) {
  const uid = req.uid as string;
  const name = req.query?.name ? String(req.query.name) : "";

  const expectedPrefix = \`uploads/\${uid}/\`;
  if (!name || !name.startsWith(expectedPrefix)) {
    return res.status(403).json({ ok: false, error: "forbidden", detail: "Invalid file path." });
  }

  try {
    const bucket = storage.bucket(getUploadBucket());
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
}

// Mount BOTH path variants (permanent)
app.get("/api/baselines/fs", requireAuthV2, baselinesFsListHandler);
app.get("/baselines/fs", requireAuthV2, baselinesFsListHandler);

app.get("/api/baselines/fs_download", requireAuthV2, baselinesFsDownloadHandler);
app.get("/baselines/fs_download", requireAuthV2, baselinesFsDownloadHandler);
`;

if (insertAt !== -1) {
  // Replace the comment block with our expanded version so it's consistent
  src = src.slice(0, insertAt) + block + "\n" + src.slice(insertAt + anchor.length);
} else {
  // Fallback: append near end
  src += "\n\n" + block + "\n";
}

fs.writeFileSync(file, src, "utf8");
console.log("OK: Mounted fs + fs_download on both /api/* and non-/api paths.");
NODE

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo
echo "==> DEPLOYED. Now test BOTH route styles with a fresh Firebase ID token."
echo "Paste JWT (starts with eyJ and has 2 dots), then press Enter:"
unset JWT 2>/dev/null || true
read -r JWT
export JWT

BASE="https://api-cbkg2trx7q-uc.a.run.app"

echo
echo "==> 1) /api/baselines/fs (should be 200 or JSON 504)"
curl -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 60

echo
echo "==> 2) /baselines/fs (should be 200 or JSON 504)"
curl -sS -i -H "Authorization: Bearer $JWT" "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 60
