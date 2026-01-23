#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step20: Fix fs_download missing_bucket + remove duplicate routes + deploy"
echo "    Target: $FILE"

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step20_$ts"
echo "==> Backup: $FILE.bak_step20_$ts"

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
const src = fs.readFileSync(file, "utf8");
const lines = src.split(/\n/);

function removeRouteBlocks(pathLiteral) {
  // Removes ALL blocks that start with: app.get("<pathLiteral>"
  // and ends at the matching "});" when brace depth returns to 0.
  let out = [];
  let i = 0;
  let removed = 0;

  while (i < lines.length) {
    const line = lines[i];
    const startMatch = line.includes(`app.get("${pathLiteral}"`);
    if (!startMatch) {
      out.push(line);
      i++;
      continue;
    }

    // We are at route start.
    removed++;
    let depth = 0;
    let startedBody = false;

    // Consume lines until we've closed the handler body and hit the terminating "});"
    while (i < lines.length) {
      const L = lines[i];

      // Route handler typically contains "=> {"
      // Track { } depth after we enter handler body
      if (L.includes("=>")) startedBody = true;

      if (startedBody) {
        // crude brace counting; good enough for these route blocks
        for (const ch of L) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
      }

      // Heuristic end: when startedBody and depth <= 0 and line contains "});"
      if (startedBody && depth <= 0 && /\}\);\s*$/.test(L.trim())) {
        i++; // consume this end line too
        break;
      }

      i++;
    }
  }

  return { out, removed };
}

// Remove all existing fs_download routes (both /api and /baselines)
let work = lines;
let totalRemoved = 0;

for (const p of ["/api/baselines/fs_download", "/baselines/fs_download"]) {
  const tmp = { lines: work };
  global.lines = tmp.lines; // expose to function (line array)
  const res = (function(path){
    const srcLines = global.lines;
    // redefine remove logic over current array
    const localLines = srcLines;
    let out = [];
    let i = 0;
    let removed = 0;

    while (i < localLines.length) {
      const line = localLines[i];
      const startMatch = line.includes(`app.get("${path}"`);
      if (!startMatch) {
        out.push(line);
        i++;
        continue;
      }
      removed++;
      let depth = 0;
      let startedBody = false;
      while (i < localLines.length) {
        const L = localLines[i];
        if (L.includes("=>")) startedBody = true;
        if (startedBody) {
          for (const ch of L) {
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
          }
        }
        if (startedBody && depth <= 0 && /\}\);\s*$/.test(L.trim())) {
          i++;
          break;
        }
        i++;
      }
    }
    return { out, removed };
  })(p);

  work = res.out;
  totalRemoved += res.removed;
}

let text = work.join("\n");

// Insert our new unified handler near the FS list routes block.
// We'll insert immediately after the line containing: app.get("/baselines/fs", requireAuthV2Timeout, __fsListHandler);
const marker = 'app.get("/baselines/fs", requireAuthV2Timeout, __fsListHandler);';
const idx = text.indexOf(marker);
if (idx === -1) {
  console.error("ERROR: Could not find marker line for FS list routes to insert after.");
  process.exit(2);
}

const insertAt = idx + marker.length;

const injection = `

  // ===== FS download (bucket-safe + base64 auto-decode) =====
  const __fsDownloadHandler = async (req: any, res: any) => {
    const uid = req.uid as string;
    const name = req.query?.name ? String(req.query.name) : "";
    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });

    const expectedPrefix = \`uploads/\${uid}/\`;
    if (!name.startsWith(expectedPrefix)) {
      return res.status(403).json({ ok: false, error: "forbidden", detail: "Invalid file path." });
    }

    try {
      const bucket = admin.storage().bucket(getUploadBucket());
      const gcsFile = bucket.file(name);

      // Guardrail: avoid huge in-memory loads
      const [meta] = await gcsFile.getMetadata();
      const size = Number((meta as any)?.size || 0);
      const MAX = 15 * 1024 * 1024; // 15MB
      if (size > MAX) return res.status(413).json({ ok: false, error: "too_large", size, max: MAX });

      // Download into memory so we can decode base64 if object was stored as base64 text
      const [buf] = await gcsFile.download();

      const head = buf.slice(0, Math.min(120, buf.length)).toString("utf8");
      let out = buf;
      let decoded = false;

      // data URL form: data:image/png;base64,....
      if (head.startsWith("data:") && head.includes(";base64,")) {
        const s = buf.toString("utf8");
        const j = s.indexOf(";base64,");
        const b64 = s.slice(j + ";base64,".length).replace(/\\s+/g, "");
        const tmp = Buffer.from(b64, "base64");
        if (tmp.length) { out = tmp; decoded = true; }
      } else {
        // plain base64 (common PNG prefix iVBORw0K)
        const compact = head.replace(/\\s+/g, "");
        if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.startsWith("iVBORw0K")) {
          const s = buf.toString("utf8").replace(/\\s+/g, "");
          const tmp = Buffer.from(s, "base64");
          if (tmp.length) { out = tmp; decoded = true; }
        }
      }

      const filename = (name.split("/").pop() || "download.bin");
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", \`attachment; filename="\${filename}"\`);
      res.setHeader("X-AIGK-Decoded-Base64", decoded ? "1" : "0");
      return res.status(200).send(out);
    } catch (e) {
      console.error("[fs_download] error", { message: String((e as any)?.message || e) });
      return res.status(500).json({ ok: false, error: "fs_download_failed", detail: String((e as any)?.message || e) });
    }
  };

  app.get("/api/baselines/fs_download", requireAuthV2Timeout, __fsDownloadHandler);
  app.get("/baselines/fs_download", requireAuthV2Timeout, __fsDownloadHandler);
  // =========================================================
`;

text = text.slice(0, insertAt) + injection + text.slice(insertAt);

// Sanity: ensure only one occurrence of each route now
const countApi = (text.match(/app\.get\(\"\/api\/baselines\/fs_download\"/g) || []).length;
const countBase = (text.match(/app\.get\(\"\/baselines\/fs_download\"/g) || []).length;
if (countApi !== 1 || countBase !== 1) {
  console.error("ERROR: route counts not 1 each after patch:", { countApi, countBase, totalRemoved });
  process.exit(3);
}

fs.writeFileSync(file, text, "utf8");
console.log("OK: removed old fs_download routes =", totalRemoved, "and installed unified bucket-safe handler.");
NODE
