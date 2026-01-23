#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step19b: Robust patch fs_download to auto-decode base64 objects"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step19b_$ts"
echo "==> Backup: $FILE.bak_step19b_$ts"

node <<'NODE'
const fs = require("fs");

const filePath = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let src = fs.readFileSync(filePath, "utf8");

const routes = [
  "/api/baselines/fs_download",
  "/baselines/fs_download",
];

function replaceRoute(route) {
  const idx = src.indexOf(`app.get("${route}"`);
  const idx2 = src.indexOf(`app.get('${route}'`);
  const start = idx >= 0 ? idx : idx2;

  if (start < 0) return { ok: false, reason: "route_not_found" };

  // Find the opening brace of the async handler block:
  // We look for the first "{\n" after the arrow "=>"
  const arrow = src.indexOf("=>", start);
  if (arrow < 0) return { ok: false, reason: "arrow_not_found" };

  const braceOpen = src.indexOf("{", arrow);
  if (braceOpen < 0) return { ok: false, reason: "brace_open_not_found" };

  // Now scan forward to find matching closing brace of this handler block
  let i = braceOpen;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return { ok: false, reason: "brace_match_failed" };

  const braceClose = i; // points at the matching "}"
  // After that there should be " );" or "});"
  const after = src.indexOf(");", braceClose);
  if (after < 0) return { ok: false, reason: "route_end_not_found" };

  // Keep the prefix from start up to braceOpen (this preserves middleware as-is),
  // then inject our new handler body, then keep the tail from braceClose onward.
  const prefix = src.slice(start, braceOpen);
  const suffix = src.slice(braceClose); // includes the "}" then ");"

  const newBody =
`{
  try {
    const name = String(req.query.name || "");
    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });

    const bucketName = process.env.UPLOADS_BUCKET || process.env.GCLOUD_STORAGE_BUCKET || "";
    if (!bucketName) return res.status(500).json({ ok: false, error: "missing_bucket" });

    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(name);

    // Guardrail: avoid huge in-memory loads
    const [meta] = await gcsFile.getMetadata();
    const size = Number(meta?.size || 0);
    const MAX = 15 * 1024 * 1024; // 15MB
    if (size > MAX) {
      return res.status(413).json({ ok: false, error: "too_large", size, max: MAX });
    }

    // Download into memory (baselines are small). Lets us decode base64 if stored as text.
    const [buf] = await gcsFile.download();

    const head = buf.slice(0, Math.min(80, buf.length)).toString("utf8");
    let out = buf;
    let decoded = false;

    if (head.startsWith("data:") && head.includes(";base64,")) {
      const s = buf.toString("utf8");
      const idx = s.indexOf(";base64,");
      const b64 = s.slice(idx + ";base64,".length);
      out = Buffer.from(b64, "base64");
      decoded = true;
    } else if (/^[A-Za-z0-9+/=\\r\\n]+$/.test(head) && head.replace(/\\s+/g,"").startsWith("iVBORw0K")) {
      const s = buf.toString("utf8").replace(/\\s+/g, "");
      out = Buffer.from(s, "base64");
      decoded = true;
    }

    const filename = name.split("/").pop() || "download.bin";
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", \`attachment; filename="\${filename}"\`);
    res.setHeader("X-AIGK-Decoded-Base64", decoded ? "1" : "0");
    res.status(200).send(out);
  } catch (e) {
    console.error("[fs_download] error", { message: String(e?.message || e) });
    res.status(500).json({ ok: false, error: "fs_download_failed", detail: String(e?.message || e) });
  }
}`;

  const originalBlock = src.slice(start, after + 2);
  const patchedBlock = prefix + newBody + suffix.slice(1); // replace the original "{"..." }" but keep closing + ");"

  src = src.replace(originalBlock, patchedBlock);
  return { ok: true };
}

const results = {};
for (const r of routes) results[r] = replaceRoute(r);

const okAny = Object.values(results).some(x => x.ok);
if (!okAny) {
  console.error("ERROR: Could not patch any fs_download routes.", results);
  process.exit(1);
}

fs.writeFileSync(filePath, src, "utf8");
console.log("OK: patched routes:", results);
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

echo "✅ Step19b DONE"
echo
echo "Test download (expect PNG header 89 50 4e 47... and X-AIGK-Decoded-Base64: 1):"
echo '  BASE="https://api-cbkg2trx7q-uc.a.run.app"'
echo '  echo "Paste fresh token:"; IFS= read -r JWT'
echo '  curl -sS -D - -o /tmp/dl.bin -H "Authorization: Bearer $JWT" "$BASE/baselines/fs_download?name=uploads%2FgRSJmVdS6hXV1dlaNalMbXgDbEA2%2F1768516756647_test-image-1.png" | head -n 40'
echo '  head -c 8 /tmp/dl.bin | od -An -t x1'
