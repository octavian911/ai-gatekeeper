#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Step16c (PERMANENT): Restore Step16b backup, then replace __fsListHandler with fail-fast Promise.race"
echo "    Target: $FILE"

# 1) Find the latest Step16b backup
BACKUP="$(ls -1t "$FILE".bak_step16b_* 2>/dev/null | head -n 1 || true)"
if [ -z "${BACKUP}" ]; then
  echo "ERROR: No Step16b backup found at $FILE.bak_step16b_*" >&2
  echo "       List backups:" >&2
  ls -1 "$FILE".bak_* 2>/dev/null || true
  exit 1
fi

echo "==> Restoring from backup: $BACKUP"
cp -f "$BACKUP" "$FILE"

echo "==> Sanity: ensure app is declared before routes"
APP_LINE="$(grep -n 'const app = express();' "$FILE" | head -n 1 || true)"
if [ -z "$APP_LINE" ]; then
  echo "ERROR: Could not find 'const app = express();' in $FILE after restore." >&2
  exit 1
fi
echo "OK: $APP_LINE"

echo "==> Sanity: show fs routes + handler references"
grep -nE '(__fsListHandler|app\.get\(\s*["'\''](/api)?/baselines/fs\b)' "$FILE" || true

# 2) Replace ONLY the __fsListHandler block (no inserting routes at top)
node <<'NODE'
const fs = require("fs");

const file = process.env.HOME + "/ai-gatekeeper/functions/src/index.ts";
let s = fs.readFileSync(file, "utf8");

const needle = "const __fsListHandler";
const i = s.indexOf(needle);
if (i < 0) {
  console.error("ERROR: Could not find 'const __fsListHandler' in index.ts. Aborting.");
  process.exit(1);
}

// Find start of block at the first "{"
const braceStart = s.indexOf("{", i);
if (braceStart < 0) {
  console.error("ERROR: Could not find '{' after __fsListHandler. Aborting.");
  process.exit(1);
}

// Walk braces to find matching "};" end
let depth = 0;
let end = -1;
for (let k = braceStart; k < s.length; k++) {
  const ch = s[k];
  if (ch === "{") depth++;
  else if (ch === "}") {
    depth--;
    if (depth === 0) {
      // Expect ");" or "};"
      const tail = s.slice(k, k + 5);
      // We will cut through the first "};" after this close brace
      const semi = s.indexOf("};", k);
      if (semi >= 0 && semi < k + 20) {
        end = semi + 2;
      } else {
        // fallback: include only the brace
        end = k + 1;
      }
      break;
    }
  }
}
if (end < 0) {
  console.error("ERROR: Could not locate end of __fsListHandler block. Aborting.");
  process.exit(1);
}

const NEW = `const __fsListHandler = async (req: any, res: any) => {
  const uid = req.uid as string;

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = \`uploads/\${uid}/\`;

  // Fail fast so we never hit the platform 60s upstream timeout
  const TIMEOUT_MS = 8000;

  try {
    const bucket = storage.bucket(getUploadBucket());

    const listPromise = bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken,
      autoPaginate: false,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("fs_list_timeout")), TIMEOUT_MS)
    );

    const race: any = await Promise.race([listPromise, timeoutPromise]);

    const files: any[] = (race && race[0]) ? race[0] : [];
    const apiResp: any = (race && race[2]) ? race[2] : {};
    const nextPageToken: string | null = apiResp?.nextPageToken ? String(apiResp.nextPageToken) : null;

    const out = (files || []).map((f: any) => ({
      name: f.name,
      size: Number(f.metadata?.size || 0),
      updated: f.metadata?.updated || null,
      // Always return /baselines download alias (works for both callers)
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
      return res.status(504).json({ ok: false, error: "fs_list_timeout", timeoutMs: TIMEOUT_MS });
    }
    console.error("[fs] error", { message: msg });
    return res.status(500).json({ ok: false, error: "fs_list_failed", detail: msg });
  }
};`;

s = s.slice(0, i) + NEW + s.slice(end);

// Collapse excessive blank lines (eslint will finish)
s = s.replace(/\n{6,}/g, "\n\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("OK: Replaced __fsListHandler with fail-fast implementation.");
NODE

# 3) Ensure both list routes point to __fsListHandler (and both exist)
if ! grep -q 'app.get("/api/baselines/fs", requireAuthV2, __fsListHandler);' "$FILE"; then
  echo "==> Fixing /api/baselines/fs route to use __fsListHandler"
  # replace any existing /api route for fs with correct one (line-based)
  perl -0777 -i -pe 's/app\.get\(\s*["'\'']\/api\/baselines\/fs["'\''][\s\S]*?\);\s*/app.get("\/api\/baselines\/fs", requireAuthV2, __fsListHandler);\n/sm' "$FILE"
fi

if ! grep -q 'app.get("/baselines/fs", requireAuthV2, __fsListHandler);' "$FILE"; then
  echo "==> Ensuring /baselines/fs alias exists"
  # add alias right after /api route line if present, else append near it
  if grep -q 'app.get("/api/baselines/fs", requireAuthV2, __fsListHandler);' "$FILE"; then
    perl -0777 -i -pe 's/app\.get\("\/api\/baselines\/fs", requireAuthV2, __fsListHandler\);\n/app.get("\/api\/baselines\/fs", requireAuthV2, __fsListHandler);\napp.get("\/baselines\/fs", requireAuthV2, __fsListHandler);\n/sm' "$FILE"
  else
    echo 'app.get("/baselines/fs", requireAuthV2, __fsListHandler);' >> "$FILE"
  fi
fi

echo "==> ESLint auto-fix index.ts"
cd "$ROOT/functions" || exit 1
npx eslint --ext .ts src/index.ts --config .eslintrc.deploy.cjs --fix

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step16c DONE"
echo "==> Verify routes present:"
grep -nE '(__fsListHandler|app\.get\(\s*["'\''](/api)?/baselines/fs\b)' "$FILE" || true
