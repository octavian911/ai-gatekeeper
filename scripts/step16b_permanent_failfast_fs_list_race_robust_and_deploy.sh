#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step16b (PERMANENT): Robust fail-fast FS list via Promise.race + ensure /api + /baselines"
echo "    Target: $FILE"

echo "==> Current routes snapshot (if any):"
grep -nE 'app\.get\(\s*["'\''](/api)?/baselines/fs(_debug|_download)?["'\'']' "$FILE" || true

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step16b_$ts"
echo "==> Backup: $FILE.bak_step16b_$ts"

node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

const FAILFAST_HANDLER = (path) => `app.get("${path}", requireAuthV2, async (req: any, res: any) => {
  const uid = req.uid as string;

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;

  // HARD fail-fast so Cloud Run never hits 60s upstream timeout
  const TIMEOUT_MS = 8000;

  try {
    // Use the same storage client you already have in the file
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

    const result = await Promise.race([listPromise, timeoutPromise]);

    // result should be [files, , apiResp]
    const files = (result && result[0]) ? result[0] : [];
    const apiResp = (result && result[2]) ? result[2] : {};
    const nextPageToken = (apiResp && apiResp.nextPageToken) ? apiResp.nextPageToken : null;

    const out = (files || []).map((f) => ({
      name: f.name,
      size: Number((f.metadata && f.metadata.size) || 0),
      updated: (f.metadata && f.metadata.updated) || null,
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
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg === "fs_list_timeout") {
      return res.status(504).json({ ok: false, error: "fs_list_timeout", timeoutMs: TIMEOUT_MS });
    }
    console.error("[fs] error", { message: msg });
    return res.status(500).json({ ok: false, error: "fs_list_failed", detail: msg });
  }
});`;

function escapeRegExp(x) {
  return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace route block if found.
 * More flexible than Step16: matches any middleware list that includes requireAuthV2,
 * then an async handler body, then closes with "});"
 */
function replaceRouteIfPresent(path) {
  const p = escapeRegExp(path);

  const re = new RegExp(
    String.raw`app\.get\(\s*["']` + p + String.raw`["']\s*,[\s\S]*?requireAuthV2[\s\S]*?,\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\}\);\s*`,
    "m"
  );

  if (!re.test(s)) return false;

  s = s.replace(re, FAILFAST_HANDLER(path) + "\n");
  return true;
}

const haveApi = replaceRouteIfPresent("/api/baselines/fs");
const haveBase = replaceRouteIfPresent("/baselines/fs");

// If neither existed in a recognizable pattern, insert both safely.
if (!haveApi && !haveBase) {
  // Prefer inserting near the baselines section if present
  const markerRe = /\/\*\*[\s\S]*?Baselines FS endpoints[\s\S]*?\*\//m;
  let insertAt = -1;

  const m = s.match(markerRe);
  if (m && m.index != null) {
    // Insert just after that comment block
    insertAt = m.index + m[0].length;
  } else {
    // Fallback: insert right before export const api = functions.onRequest(
    const exportIdx = s.indexOf("export const api = functions.onRequest");
    if (exportIdx >= 0) insertAt = exportIdx;
  }

  if (insertAt < 0) {
    console.error("ERROR: Could not find insertion point (Baselines FS comment or export const api). Aborting.");
    process.exit(1);
  }

  const insertion =
    "\n\n" +
    FAILFAST_HANDLER("/api/baselines/fs") +
    "\n\n" +
    FAILFAST_HANDLER("/baselines/fs") +
    "\n\n";

  s = s.slice(0, insertAt) + insertion + s.slice(insertAt);
}

// Ensure both routes exist (clone from whichever exists now)
function ensureRouteExists(path) {
  const p = escapeRegExp(path);
  const existsLoose = new RegExp(String.raw`app\.get\(\s*["']` + p + String.raw`["']`, "m").test(s);
  return existsLoose;
}

if (!ensureRouteExists("/api/baselines/fs") && ensureRouteExists("/baselines/fs")) {
  // Clone /baselines/fs handler to /api/baselines/fs
  const re = /app\.get\(\s*["']\/baselines\/fs["'][\s\S]*?\n\}\);\s*/m;
  const mm = s.match(re);
  if (mm) {
    s = mm[0].replace(/\/baselines\/fs/g, "/api/baselines/fs") + "\n\n" + s;
  }
}

if (!ensureRouteExists("/baselines/fs") && ensureRouteExists("/api/baselines/fs")) {
  // Clone /api/baselines/fs handler to /baselines/fs
  const re = /app\.get\(\s*["']\/api\/baselines\/fs["'][\s\S]*?\n\}\);\s*/m;
  const mm = s.match(re);
  if (mm) {
    s = mm[0].replace(/\/api\/baselines\/fs/g, "/baselines/fs") + "\n\n" + s;
  }
}

// Reduce crazy empty-line runs (eslint will finalize)
s = s.replace(/\n{6,}/g, "\n\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("OK: fail-fast handler installed and /api + /baselines routes ensured.");
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

echo "✅ Step16b DONE"
echo "==> Post-deploy route check:"
grep -nE 'app\.get\(\s*["'\''](/api)?/baselines/fs["'\'']' "$FILE" || true
