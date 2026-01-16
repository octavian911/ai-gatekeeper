#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== Task 5: Add GET /baselines/fs route + deploy =="
echo "INDEX_TS: $INDEX_TS"
echo

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// If route already exists, do nothing
if (/app\.get\(\s*["']\/baselines\/fs["']/.test(s) || /app\.get\(\s*["']\/api\/baselines\/fs["']/.test(s)) {
  console.log("ℹ️  /baselines/fs route already present. No patch needed.");
  process.exit(0);
}

// Find a good insertion point: after requireAuth middleware definition or after debug routes.
// We'll insert after the last debug route if present, else after cors/body parser lines.
const lines = s.split("\n");
let insertAt = -1;

// Prefer inserting after debug/env route (keeps routes grouped)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('app.get("/api/debug/env"')) insertAt = i + 1;
}
if (insertAt === -1) {
  // fallback: insert after cors/body parser block near top
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("app.use(cors(")) insertAt = i + 1;
  }
}
if (insertAt === -1) insertAt = 0;

const route = `
/**
 * List baseline files stored in GCS for the authenticated user.
 * Note: With Hosting rewrite + /api stripper, callers hit:
 *   GET /api/baselines/fs  -> Express sees /baselines/fs
 */
app.get("/baselines/fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = req?.user?.uid || req?.auth?.uid || req?.claims?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const prefix = \`uploads/\${uid}/\`;

    const [files] = await bucket.getFiles({ prefix });
    const items = (files || []).map((f: any) => {
      const name = f?.name || "";
      const filename = name.replace(prefix, "");
      const ct = f?.metadata?.contentType || "";
      const size = Number(f?.metadata?.size || 0);
      return {
        object: name,
        filename,
        mimeType: ct,
        bytes: size,
        downloadPath: \`/api/download?object=\${encodeURIComponent(name)}\`
      };
    });

    // Avoid CDN caching "old" lists while iterating
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, count: items.length, files: items });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "list_failed", message: String(e?.message || e) });
  }
});
`.trimEnd();

lines.splice(insertAt + 1, 0, "", route, "");
s = lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
fs.writeFileSync(file, s, "utf8");
console.log("✅ Inserted GET /baselines/fs route");
NODE

echo
echo "== Lint/build (must pass) =="
cd "$FUNCTIONS_DIR"
npm run lint -- --fix
npm run lint
npm run build

echo
echo "== Deploy functions:api =="
cd "$ROOT_DIR"
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== Probe with cache buster (expect JSON 401, not HTML 404) =="
TS=$(date +%s)
curl -i "https://$SITE/api/baselines/fs?t=$TS" | head -n 50 || true

echo
echo "== DONE ✅ =="
