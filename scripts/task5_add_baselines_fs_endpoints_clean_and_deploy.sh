#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
SITE="${SITE:-ai-gatekeeper-app.web.app}"

echo "== Task 5: Add Baselines FS endpoints cleanly + upload alias + deploy =="
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo "SITE:       https://$SITE"
echo

[[ -f "$INDEX_TS" ]] || { echo "ERROR: index.ts not found at $INDEX_TS" >&2; exit 1; }

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// Helper: insert text once after a marker regex
function insertOnceAfter(markerRe, snippet, guardRe) {
  if (guardRe.test(s)) return false;
  const m = s.match(markerRe);
  if (!m) throw new Error("Marker not found for insertion: " + markerRe);
  const idx = m.index + m[0].length;
  s = s.slice(0, idx) + "\n" + snippet.trimEnd() + "\n" + s.slice(idx);
  return true;
}

// 1) Ensure upload alias exists: POST /baselines/upload-multi-fs -> uploadMultiFsHandler
if (!/app\.post\(\s*["']\/baselines\/upload-multi-fs["']/.test(s)) {
  // insert right after the existing /upload-multi-fs route
  const marker = /app\.post\(\s*["']\/upload-multi-fs["'][\s\S]*?\);\s*/;
  if (!marker.test(s)) throw new Error("Could not find existing app.post('/upload-multi-fs'...) route");
  s = s.replace(marker, (block) => block + `\napp.post("/baselines/upload-multi-fs", requireAuth, uploadMultiFsHandler);\n`);
}

// 2) Add baselines fs endpoints (idempotent)
const guard = /\/\*\*\s*\n\s*\*\s*Baselines FS endpoints \(GCS-backed\)/;
if (!guard.test(s)) {
  const snippet = `
/**
 * Baselines FS endpoints (GCS-backed)
 * Stored under: uploads/<uid>/
 * NOTE: These are "baselines" endpoints, but currently map to the same upload bucket objects.
 */

// List files for current user
app.get("/baselines/fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const prefix = \`uploads/\${uid}/\`;

    const [files] = await bucket.getFiles({ prefix });
    const out = (files || [])
      .filter((f: any) => f && f.name && !String(f.name).endsWith("/"))
      .map((f: any) => {
        const name = String(f.name);
        const filename = name.startsWith(prefix) ? name.slice(prefix.length) : name;
        return {
          object: name,
          filename,
          downloadPath: \`/api/download?object=\${encodeURIComponent(name)}\`,
        };
      });

    return res.json({ ok: true, count: out.length, files: out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "list_failed", message: String(e?.message || e) });
  }
});

// Delete files matching screenId prefix (supports multiple)
app.delete("/baselines/:screenId/fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const screenId = String(req.params.screenId || "").trim();
    if (!screenId) return res.status(400).json({ ok: false, error: "missing_screenId" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const userPrefix = \`uploads/\${uid}/\`;
    const matchPrefix = \`\${userPrefix}\${screenId}\`;

    const [files] = await bucket.getFiles({ prefix: matchPrefix });
    const targets = (files || []).filter((f: any) => f && f.name && !String(f.name).endsWith("/"));

    // If nothing matches, return ok with 0 removed (idempotent)
    if (!targets.length) return res.json({ ok: true, removed: 0, objects: [] });

    const objects: string[] = [];
    for (const f of targets) {
      const name = String(f.name);
      objects.push(name);
      await bucket.file(name).delete({ ignoreNotFound: true }).catch(() => {});
    }

    return res.json({ ok: true, removed: objects.length, objects });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "delete_failed", message: String(e?.message || e) });
  }
});

// Get image-fs for a screenId prefix: redirects to /api/download?object=...
app.get("/baselines/:screenId/image-fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const screenId = String(req.params.screenId || "").trim();
    if (!screenId) return res.status(400).json({ ok: false, error: "missing_screenId" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const userPrefix = \`uploads/\${uid}/\`;
    const matchPrefix = \`\${userPrefix}\${screenId}\`;

    const [files] = await bucket.getFiles({ prefix: matchPrefix });
    const first = (files || []).find((f: any) => f && f.name && !String(f.name).endsWith("/"));

    if (!first || !first.name) return res.status(404).json({ ok: false, error: "not_found" });

    const object = String(first.name);
    // Keep this as /api/download so Hosting rewrite routes it properly.
    return res.redirect(302, \`/api/download?object=\${encodeURIComponent(object)}\`);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "image_failed", message: String(e?.message || e) });
  }
});
`;
  // Insert these endpoints just BEFORE the download route, so they’re above it.
  // Marker: app.get("/download"
  insertOnceAfter(
    /(\/\*[\s\S]*?\*\/\s*)?(\s*)app\.get\(\s*["']\/download["']/,
    "\n" + snippet + "\n\napp.get(\"/download\"",
    guard
  );

  // The insertOnceAfter above re-inserts app.get("/download" because we used it as marker;
  // Now we must remove the duplicated "app.get("/download"" token we placed.
  // We inserted snippet + 'app.get("/download"' literal; so replace the first occurrence of 'app.get("/download"' with placeholder, then restore the original.
  // Simpler: just fix the accidental duplication by turning 'app.get("/download"' into nothing once right after insertion.
  // But since we re-injected the literal marker, we need to ensure we don't end up with 'app.get("/download"app.get("/download"'.
  s = s.replace(/app\.get\("\/download"\s*\n\s*app\.get\(\s*["']\/download["']/, 'app.get("/download"\n');
}

// 3) Remove the old stub if present (a 501 on /baselines/upload-multi-fs)
s = s.replace(
  /app\.post\(\s*["']\/baselines\/upload-multi-fs["'][\s\S]*?res\.status\(\s*501\s*\)[\s\S]*?\}\);\s*/g,
  ""
);

// Re-add the correct alias again if stub removal removed it
if (!/app\.post\(\s*["']\/baselines\/upload-multi-fs["']/.test(s)) {
  if (!/app\.post\(\s*["']\/upload-multi-fs["']/.test(s)) {
    throw new Error("Expected /upload-multi-fs route missing; cannot add baselines alias");
  }
  s = s.replace(
    /app\.post\(\s*["']\/upload-multi-fs["'][\s\S]*?\);\s*/m,
    (m) => m + `\napp.post("/baselines/upload-multi-fs", requireAuth, uploadMultiFsHandler);\n`
  );
}

// Collapse 3+ blank lines
s = s.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched index.ts: baselines fs endpoints + upload alias ensured");
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
echo "== Quick probes (expect JSON 401 without auth) =="
set +e
curl -sS -i "https://$SITE/api/__health" | sed -n '1,40p'
echo
curl -sS -i "https://$SITE/api/baselines/fs" | sed -n '1,80p'
echo
curl -sS -i -X DELETE "https://$SITE/api/baselines/SC-TEST/fs" | sed -n '1,80p'
set -e

echo
echo "== DONE ✅ =="
echo "Next: open https://$SITE/baselines and confirm the page can list + download."
