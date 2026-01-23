#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILEPATH="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step13 (PERMANENT): Harden /api/baselines/fs to fail-fast + minimal work"
echo "    Target: $FILEPATH"

# Backup once
ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILEPATH" "$FILEPATH.bak_step13_$ts"
echo "==> Backup: $FILEPATH.bak_step13_$ts"

# IMPORTANT: pass FILE env into node
FILE="$FILEPATH" node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
if (!file) {
  console.error("ERROR: Missing FILE env (should be passed as FILE=... node ...)");
  process.exit(2);
}

let src = fs.readFileSync(file, "utf8");

// Replace the entire /api/baselines/fs handler block.
const re = /app\.get\(\s*["']\/api\/baselines\/fs["']\s*,[\s\S]*?\n\}\);\n/s;

if (!re.test(src)) {
  console.error('ERROR: Could not find app.get("/api/baselines/fs"... ) block to replace.');
  process.exit(2);
}

const replacement = `
app.get("/api/baselines/fs", requireAuthV2, async (req: any, res: any) => {
  const uid = req.uid as string;
  const t0 = Date.now();

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;

  // Hard fail-fast so we never hit platform 60s timeouts.
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

    // Use direct GCS client already used elsewhere in this file.
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

    // Minimal output (no metadata reads, no signed URLs)
    const out = (files || []).map((f: any) => ({
      name: f.name,
      downloadUrl: \`/api/baselines/fs_download?name=\${encodeURIComponent(f.name)}\`,
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
        detail: "Listing files exceeded 12s. Likely bucket permissions/egress issue.",
      });
    }

    return res.status(500).json({
      ok: false,
      error: "fs_list_failed",
      detail: msg,
    });
  }
});
`;

src = src.replace(re, replacement + "\n");
fs.writeFileSync(file, src, "utf8");
console.log("OK: Replaced /api/baselines/fs handler with fail-fast minimal version.");
NODE

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "==> DONE. Test now."
BASE="https://api-cbkg2trx7q-uc.a.run.app"

echo "Paste a FRESH Firebase ID token (starts with eyJ and has 2 dots), then press Enter:"
unset JWT 2>/dev/null || true
read -r JWT
export JWT

echo "token len=$(printf %s "$JWT" | wc -c) dots=$(printf %s "$JWT" | awk -F. '{print NF-1}')"

echo
echo "==> fs_debug (should be 200)"
curl -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs_debug?t=$(date +%s)" | head -n 40

echo
echo "==> fs list (should be 200 OR JSON 504 fs_list_timeout)"
curl -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 80
