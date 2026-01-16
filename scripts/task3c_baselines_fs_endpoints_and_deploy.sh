#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== Task 3C: Baselines FS endpoints + remove stub + fix download route (strip /api) =="
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo "SITE:       https://$SITE"
echo

[ -f "$INDEX_TS" ] || { echo "ERROR: index.ts not found at $INDEX_TS" >&2; exit 1; }

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
if (!file) throw new Error("Missing INDEX_TS path arg");

let s = fs.readFileSync(file, "utf8");

// 1) Remove the early 501 stub for /baselines/upload-multi-fs (it blocks the real handler)
const stubRe = /app\.post\(\s*["']\/baselines\/upload-multi-fs["']\s*,\s*\(\s*_req\s*,\s*res\s*\)\s*=>\s*\{\s*[\s\S]*?res\.status\(\s*501\s*\)\.json\([\s\S]*?\);\s*\}\s*\);\s*/m;
s = s.replace(stubRe, "");

// 2) Make download route compatible with /api stripper:
// If request comes in as /api/download it becomes /download, so define route as /download.
s = s.replace(/app\.get\(\s*["']\/api\/download["']\s*,/g, 'app.get("/download",');

// 3) Inject Baselines FS endpoints if not present
if (!s.includes('app.get("/baselines/fs"')) {
  const marker = 'app.post("/baselines/upload-multi-fs", requireAuth, uploadMultiFsHandler);';
  if (!s.includes(marker)) {
    throw new Error("Could not find marker route to inject after: " + marker);
  }

  const inject = `

/**
 * Baselines (FS mode) endpoints for the frontend.
 * Backed by GCS objects currently stored under uploads/<uid>/...
 * Frontend hits /api/...; Hosting rewrite + /api stripper makes Express see /baselines/...
 */
app.get("/baselines/fs", requireAuth, async (req: AuthedReq, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const bucket = getUploadBucket();
  const prefix = \`uploads/\${uid}/\`;

  const [files] = await bucket.getFiles({ prefix });
  const items = await Promise.all(
    files
      .filter((f: any) => f?.name && !String(f.name).endsWith("/"))
      .map(async (f: any) => {
        const base = path.basename(String(f.name));
        const screenId = path.parse(base).name;
        let meta: any = {};
        try { [meta] = await f.getMetadata(); } catch {}
        const size = Number(meta?.size || 0);
        const contentType = meta?.contentType || "application/octet-stream";
        const updatedAt = meta?.updated || meta?.timeCreated || null;

        return {
          screenId,
          filename: base,
          object: String(f.name),
          size,
          contentType,
          updatedAt,
          // Frontend uses /api/download; /api stripper will convert it to /download.
          downloadPath: \`/api/download?object=\${encodeURIComponent(String(f.name))}\`,
        };
      })
  );

  items.sort((a: any, b: any) => String(a.screenId).localeCompare(String(b.screenId)));
  return res.json({ ok: true, count: items.length, items, files: items });
});

app.get("/baselines/:screenId/image-fs", requireAuth, async (req: AuthedReq, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const screenId = String(req.params.screenId || "");
  const bucket = getUploadBucket();
  const prefix = \`uploads/\${uid}/\`;
  const [files] = await bucket.getFiles({ prefix });

  const match =
    files.find((f: any) => path.parse(path.basename(String(f.name))).name === screenId) ||
    files.find((f: any) => path.basename(String(f.name)).startsWith(screenId));

  if (!match) return res.status(404).json({ ok: false, error: "not_found", screenId });

  let meta: any = {};
  try { [meta] = await match.getMetadata(); } catch {}

  res.setHeader("Content-Type", meta?.contentType || "image/png");
  res.setHeader("Cache-Control", "no-store");

  const stream = match.createReadStream();
  stream.on("error", (e: any) => {
    if (!res.headersSent) res.status(500).json({ ok: false, error: "read_error", message: String(e?.message || e) });
  });
  stream.pipe(res);
});

app.delete("/baselines/:screenId/fs", requireAuth, async (req: AuthedReq, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  const screenId = String(req.params.screenId || "");
  const bucket = getUploadBucket();
  const prefix = \`uploads/\${uid}/\`;
  const [files] = await bucket.getFiles({ prefix });

  const matches = files.filter((f: any) => {
    const base = path.basename(String(f.name));
    const sid = path.parse(base).name;
    return sid === screenId || base.startsWith(screenId);
  });

  if (!matches.length) return res.status(404).json({ ok: false, error: "not_found", screenId });

  await Promise.all(matches.map((f: any) => f.delete({ ignoreNotFound: true }).catch(() => null)));
  return res.json({ ok: true, deleted: matches.map((f: any) => String(f.name)) });
});
`;

  s = s.replace(marker, marker + inject);
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched:", file);
NODE

echo
echo "== Lint/build/deploy functions:api =="
cd "$FUNCTIONS_DIR"
npm run lint -- --fix
npm run lint
npm run build

cd "$ROOT_DIR"
firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== Smoke (route existence) =="
echo "-- GET /api/__health (should be 200 JSON)"
curl -sS -i "https://$SITE/api/__health" | sed -n '1,25p' || true
echo
echo "-- GET /api/baselines/fs (should be 401 JSON, not HTML Cannot GET)"
curl -sS -i "https://$SITE/api/baselines/fs" | sed -n '1,25p' || true
echo
echo "-- POST /api/baselines/upload-multi-fs (should be 401 JSON, not HTML Cannot POST)"
curl -sS -i -X POST "https://$SITE/api/baselines/upload-multi-fs" | sed -n '1,25p' || true

echo
echo "== DONE ✅ =="
echo "Next: open https://$SITE/baselines and refresh. List + delete + image-fs should now resolve to real routes."
