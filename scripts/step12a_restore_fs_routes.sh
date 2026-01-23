#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step12a: Ensure /api/baselines/fs and /api/baselines/fs_download routes exist: $FILE"

# Backup
cp -f "$FILE" "$FILE.bak.$(date +%s)"

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
let s = fs.readFileSync(file, "utf8");

const hasFs = s.includes('"/api/baselines/fs"') || s.includes("'/api/baselines/fs'");
const hasDownload = s.includes('"/api/baselines/fs_download"') || s.includes("'/api/baselines/fs_download'");
const hasDebug = s.includes('"/api/baselines/fs_debug"') || s.includes("'/api/baselines/fs_debug'");

if (!hasDebug) {
  console.error("ERROR: Cannot find /api/baselines/fs_debug in index.ts. Aborting to avoid bad patch.");
  process.exit(2);
}

if (!hasFs) {
  // Insert fs list route right after fs_debug route block (safe anchor: the fs_debug path string)
  // We insert using a simple anchor: the first occurrence of /api/baselines/fs_debug
  const anchor = /(["']\/api\/baselines\/fs_debug["'][\s\S]*?\}\);)/m;
  const m = s.match(anchor);
  if (!m) {
    console.error("ERROR: Couldn't locate fs_debug handler block to anchor insertion.");
    process.exit(3);
  }

  const insert = `
\n// ---- FS list: fast single-page list (no signed URLs) ----
app.get("/api/baselines/fs", async (req, res) => {
  try {
    // Reuse the same auth/uid logic fs_debug uses:
    // If your project uses req.uid from middleware, this will work.
    const uid = (req.uid || (req as any).uid || (res.locals && res.locals.uid)) as string | undefined;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized", detail: "Missing uid" });

    const limitRaw = req.query && req.query.limit ? String(req.query.limit) : "20";
    const limit = Math.max(1, Math.min(50, parseInt(limitRaw, 10) || 20));
    const prefix = \`uploads/\${uid}/\`;

    const bucket = admin.storage().bucket(getUploadBucket());

    const [files, , apiResp] = await bucket.getFiles({
      prefix,
      maxResults: limit,
      autoPaginate: false,
    });

    const out = (files || []).map((f) => ({
      name: f.name,
      size: (f.metadata && f.metadata.size) ? Number(f.metadata.size) : undefined,
      updated: (f.metadata && f.metadata.updated) ? f.metadata.updated : undefined,
      // download proxy route (avoid signed URLs)
      downloadUrl: \`/api/baselines/fs_download?name=\${encodeURIComponent(f.name)}\`,
    }));

    const nextPageToken = (apiResp && apiResp.nextPageToken) ? apiResp.nextPageToken : undefined;

    return res.json({ ok: true, prefix, count: out.length, files: out, nextPageToken });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "fs_list_failed", message: String(e?.message || e) });
  }
});
`;

  s = s.replace(anchor, `$1${insert}`);
  console.log("OK: inserted /api/baselines/fs route after fs_debug.");
} else {
  console.log("OK: /api/baselines/fs already present (no change).");
}

if (!hasDownload) {
  // Append download route near the end (safe approach)
  const dl = `
\n// ---- FS download proxy: streams object (no signed URLs) ----
app.get("/api/baselines/fs_download", async (req, res) => {
  try {
    const uid = (req.uid || (req as any).uid || (res.locals && res.locals.uid)) as string | undefined;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized", detail: "Missing uid" });

    const name = req.query && req.query.name ? String(req.query.name) : "";
    if (!name) return res.status(400).json({ ok: false, error: "bad_request", detail: "Missing name" });

    // Ensure user can only download from their own prefix
    const allowedPrefix = \`uploads/\${uid}/\`;
    if (!name.startsWith(allowedPrefix)) {
      return res.status(403).json({ ok: false, error: "forbidden", detail: "Invalid object path" });
    }

    const bucket = admin.storage().bucket(getUploadBucket());
    const file = bucket.file(name);

    // Stream directly (fast)
    res.setHeader("Content-Disposition", "inline");
    file.createReadStream()
      .on("error", (err) => {
        res.status(404).json({ ok: false, error: "not_found", message: String(err?.message || err) });
      })
      .pipe(res);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "fs_download_failed", message: String(e?.message || e) });
  }
});
`;
  s += "\n" + dl;
  console.log("OK: appended /api/baselines/fs_download route.");
} else {
  console.log("OK: /api/baselines/fs_download already present (no change).");
}

fs.writeFileSync(file, s);
NODE
