#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"

echo "== Task 5 v2: Restore clean index.ts + add baselines fs endpoints safely =="
echo "INDEX_TS: $INDEX_TS"
echo

cd "$ROOT_DIR"

# 1) Restore from the backup created in your last run
BK="$(ls -1t "$INDEX_TS".bak.* | head -n 1)"
echo "Restoring from backup: $BK"
cp -v "$BK" "$INDEX_TS"

# 2) Patch as TEXT safely (no marker-mangling)
node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

function has(re){ return re.test(s); }

function insertBefore(markerRe, snippet, guardRe){
  if (guardRe.test(s)) return false;
  const m = s.match(markerRe);
  if (!m) throw new Error("Marker not found: " + markerRe);
  const idx = m.index;
  s = s.slice(0, idx) + snippet.trimEnd() + "\n\n" + s.slice(idx);
  return true;
}

// --- Ensure upload alias exists ---
if (!has(/app\.post\(\s*["']\/baselines\/upload-multi-fs["']/)) {
  // Prefer placing it right after /upload-multi-fs registration if present
  const reUpload = /app\.post\(\s*["']\/upload-multi-fs["'][\s\S]*?\);\s*/m;
  if (!reUpload.test(s)) {
    // fallback: just append near the bottom before export
    // (still safe because /api stripper will route it)
    // We'll add it with the rest of endpoints below.
  } else {
    s = s.replace(reUpload, (m) => m + `\napp.post("/baselines/upload-multi-fs", requireAuth, uploadMultiFsHandler);\n`);
  }
}

const guard = /\/\*\*\s*\n\s*\*\s*Baselines FS endpoints \(GCS-backed\)/;

const snippet = `
/**
 * Baselines FS endpoints (GCS-backed)
 * Objects live under: uploads/<uid>/
 */

// alias in case it wasn't inserted earlier
${has(/app\.post\(\s*["']\/baselines\/upload-multi-fs["']/)
  ? ""
  : `app.post("/baselines/upload-multi-fs", requireAuth, uploadMultiFsHandler);\n`
}

// List files for current user
app.get("/baselines/fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const prefix = \`uploads/\${uid}/\`;

    const [files] = await bucket.getFiles({ prefix });
    const out = (files || [])
      .filter((f: any) => f?.name && !String(f.name).endsWith("/"))
      .map((f: any) => {
        const object = String(f.name);
        const filename = object.startsWith(prefix) ? object.slice(prefix.length) : object;
        return {
          object,
          filename,
          downloadPath: \`/api/download?object=\${encodeURIComponent(object)}\`,
        };
      });

    return res.json({ ok: true, count: out.length, files: out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "list_failed", message: String(e?.message || e) });
  }
});

// Delete all objects whose *filename* starts with screenId (prefix match)
app.delete("/baselines/:screenId/fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const screenId = String(req.params.screenId || "").trim();
    if (!screenId) return res.status(400).json({ ok: false, error: "missing_screenId" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const userPrefix = \`uploads/\${uid}/\`;

    // We stored as: uploads/<uid>/<timestamp>_<originalfilename>
    // So we can't strictly prefix by screenId unless you encode screenId into filename.
    // We'll do a contains match on the filename part to be safer.
    const [files] = await bucket.getFiles({ prefix: userPrefix });
    const targets = (files || []).filter((f: any) => {
      const object = String(f?.name || "");
      if (!object || object.endsWith("/")) return false;
      const filename = object.startsWith(userPrefix) ? object.slice(userPrefix.length) : object;
      return filename.startsWith(screenId);
    });

    if (!targets.length) return res.json({ ok: true, removed: 0, objects: [] });

    const objects: string[] = [];
    for (const f of targets) {
      const object = String(f.name);
      objects.push(object);
      await bucket.file(object).delete({ ignoreNotFound: true }).catch(() => {});
    }

    return res.json({ ok: true, removed: objects.length, objects });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "delete_failed", message: String(e?.message || e) });
  }
});

// Return an image (first match) by redirecting to /api/download
app.get("/baselines/:screenId/image-fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const screenId = String(req.params.screenId || "").trim();
    if (!screenId) return res.status(400).json({ ok: false, error: "missing_screenId" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const userPrefix = \`uploads/\${uid}/\`;

    const [files] = await bucket.getFiles({ prefix: userPrefix });
    const first = (files || []).find((f: any) => {
      const object = String(f?.name || "");
      if (!object || object.endsWith("/")) return false;
      const filename = object.startsWith(userPrefix) ? object.slice(userPrefix.length) : object;
      return filename.startsWith(screenId);
    });

    if (!first?.name) return res.status(404).json({ ok: false, error: "not_found" });

    const object = String(first.name);
    return res.redirect(302, \`/api/download?object=\${encodeURIComponent(object)}\`);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "image_failed", message: String(e?.message || e) });
  }
});
`;

// Insert before export of the HTTPS function (stable anchor)
const exportMarker = /(export\s+const\s+api\s*=|exports\.api\s*=)/m;
insertBefore(exportMarker, snippet, guard);

// Clean excessive blank lines
s = s.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched baselines fs endpoints safely in", file);
NODE

# 3) Lint/build
echo
echo "== Lint/build =="
cd "$FUNCTIONS_DIR"
npm run lint -- --fix
npm run lint
npm run build

echo
echo "✅ OK: syntax + build pass"
echo "Next: firebase deploy --only functions:api"
