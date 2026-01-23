#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step19: Patch fs_download to auto-decode base64 objects (if stored as base64 text)"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step19_$ts"
echo "==> Backup: $FILE.bak_step19_$ts"

node <<'NODE'
const fs = require("fs");

const filePath = process.env.FILE || (process.env.HOME + "/ai-gatekeeper/functions/src/index.ts");
let src = fs.readFileSync(filePath, "utf8");

// We will patch BOTH handlers: /api/baselines/fs_download and /baselines/fs_download
// Strategy:
// - Fetch metadata for size (reject huge files to avoid memory blowups)
// - file.download() into Buffer (ok for baselines)
// - Detect base64 by checking if it begins with 'iVBORw0K' (PNG) or 'data:*;base64,'
// - If base64, decode to binary buffer
// - Send with correct headers

function patchOneRoute(route) {
  // Match: app.get("ROUTE", requireAuthV2Timeout, async (req...){ ... });
  // or requireAuthV2, etc. We'll allow any middleware name.
  const re = new RegExp(
    String.raw`app\.get$begin:math:text$\\s\*\[\"\'\]\$\{route\}\[\"\'\]\\s\*\,\\s\*\(\[a\-zA\-Z0\-9\_\]\+\)\\s\*\,\\s\*async\\s\*\\\(req\:\\s\*any\,\\s\*res\:\\s\*any$end:math:text$\s*=>\s*\{\s*([\s\S]*?)\n\}\s*\);\n`,
    "m"
  );

  const m = src.match(re);
  if (!m) return false;

  const middleware = m[1];

  const replacement =
`app.get("${route}", ${middleware}, async (req: any, res: any) => {
  try {
    const name = String(req.query.name || "");
    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });

    const bucketName = process.env.UPLOADS_BUCKET || process.env.GCLOUD_STORAGE_BUCKET || "";
    if (!bucketName) return res.status(500).json({ ok: false, error: "missing_bucket" });

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(name);

    // Guardrail: avoid huge in-memory loads
    const [meta] = await file.getMetadata();
    const size = Number(meta?.size || 0);
    const MAX = 15 * 1024 * 1024; // 15MB
    if (size > MAX) {
      return res.status(413).json({ ok: false, error: "too_large", size, max: MAX });
    }

    // Download object into memory (baselines are small). This lets us decode base64 if needed.
    const [buf] = await file.download();

    // Detect base64 text payloads (common if frontend uploaded dataURL/base64 string)
    const head = buf.slice(0, Math.min(64, buf.length)).toString("utf8");
    let out = buf;
    let decoded = false;

    // If it looks like data URL, strip prefix then decode
    if (head.startsWith("data:") && head.includes(";base64,")) {
      const s = buf.toString("utf8");
      const idx = s.indexOf(";base64,");
      const b64 = s.slice(idx + ";base64,".length);
      out = Buffer.from(b64, "base64");
      decoded = true;
    } else if (/^[A-Za-z0-9+/=\\r\\n]+$/.test(head) && head.startsWith("iVBORw0K")) {
      // Very likely base64(PNG)
      const s = buf.toString("utf8").replace(/\\s+/g, "");
      out = Buffer.from(s, "base64");
      decoded = true;
    }

    // Best-effort filename
    const filename = name.split("/").pop() || "download.bin";

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", \`attachment; filename="\${filename}"\`);
    res.setHeader("X-AIGK-Decoded-Base64", decoded ? "1" : "0");
    res.status(200).send(out);
  } catch (e: any) {
    console.error("[fs_download] error", { message: String(e?.message || e) });
    res.status(500).json({ ok: false, error: "fs_download_failed", detail: String(e?.message || e) });
  }
});
`;

  src = src.replace(re, replacement + "\n");
  return true;
}

const ok1 = patchOneRoute("/api/baselines/fs_download");
const ok2 = patchOneRoute("/baselines/fs_download");

if (!ok1 && !ok2) {
  console.error("ERROR: Could not find fs_download routes to patch. Aborting.");
  process.exit(1);
}

fs.writeFileSync(filePath, src, "utf8");
console.log("OK: Patched fs_download route(s):", { api: ok1, baselines: ok2 });
NODE

echo "==> ESLint auto-fix (index.ts only)"
cd "$ROOT/functions" || exit 1
npx eslint --fix src/index.ts --config .eslintrc.deploy.cjs >/dev/null || true

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step19 DONE"
echo
echo "Test:"
echo '  BASE="https://api-cbkg2trx7q-uc.a.run.app"'
echo '  echo "Paste fresh token:"; IFS= read -r JWT'
echo '  curl -sS -D - -o /tmp/dl.bin -H "Authorization: Bearer $JWT" "$BASE/baselines/fs_download?name=uploads%2FgRSJmVdS6hXV1dlaNalMbXgDbEA2%2F1768516756647_test-image-1.png" | head -n 40'
echo '  wc -c /tmp/dl.bin'
echo '  head -c 8 /tmp/dl.bin | od -An -t x1'
