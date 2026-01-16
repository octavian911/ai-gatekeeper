#!/usr/bin/env bash
# NOEXIT: never returns exit code 1
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
BACKUP="$ROOT_DIR/.backup_task18_frontend_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

echo "== Task18 Frontend: force Authorization header (NOEXIT) =="
echo "FRONTEND: $FRONTEND_DIR"
echo "BACKUP:   $BACKUP"

# Find the file that IMPLEMENTS callTypedAPI (not just calls it)
TARGET="$(grep -RIl "async callTypedAPI" "$FRONTEND_DIR" 2>/dev/null | head -n 1)"

if [ -z "$TARGET" ]; then
  echo "WARN: could not find callTypedAPI implementation. Searching for fetch wrapper..."
  TARGET="$(grep -RIl "fetch\\(" "$FRONTEND_DIR/src" 2>/dev/null | head -n 1)"
fi

echo "TARGET: $TARGET"
if [ -z "$TARGET" ] || [ ! -f "$TARGET" ]; then
  echo "WARN: no target file found to patch"
  exit 0
fi

cp -a "$TARGET" "$BACKUP/$(basename "$TARGET")" 2>/dev/null || true

node - "$TARGET" <<'NODE'
const fs = require("fs");
const f = process.argv[2];
let t = fs.readFileSync(f, "utf8");

if (!t.includes("async function __getIdTokenSafe")) {
  t = `// injected by task18\nasync function __getIdTokenSafe(): Promise<string> {\n  try {\n    const m: any = await import("firebase/auth");\n    const auth = m.getAuth?.();\n    const u = auth?.currentUser;\n    if (!u) return \"\";\n    return await u.getIdToken?.(true);\n  } catch (e) {\n    return \"\";\n  }\n}\n\n` + t;
}

// Patch inside callTypedAPI: add Authorization header before fetch
// We try to insert right before the first "fetch(" inside callTypedAPI.
const idx = t.indexOf("async callTypedAPI");
if (idx !== -1) {
  const slice = t.slice(idx);
  const fetchPos = slice.indexOf("fetch(");
  if (fetchPos !== -1) {
    const insertAt = idx + fetchPos;
    // Avoid double insertion
    if (!t.includes("__getIdTokenSafe") || !t.includes("Authorization")) {
      // already has helper; still insert header logic if missing
    }
    const headerLogic =
`\n// --- task18: attach Firebase ID token ---\ntry {\n  const tok = await __getIdTokenSafe();\n  if (tok) {\n    const h = new Headers((init as any)?.headers || {});\n    h.set("Authorization", "Bearer " + tok);\n    (init as any).headers = h;\n  }\n} catch (e) {}\n// --- end task18 ---\n\n`;
    // Insert only if not present
    if (!t.includes("attach Firebase ID token")) {
      t = t.slice(0, insertAt) + headerLogic + t.slice(insertAt);
    }
  }
}

fs.writeFileSync(f, t);
console.log("Patched:", f);
NODE

echo "== Build frontend (best-effort) =="
npm --prefix "$FRONTEND_DIR" run build || true

echo "== Deploy hosting (ALL sites) =="
firebase deploy --only hosting --project "$PROJECT_ID" || true

echo "DONE frontend (NOEXIT)"
exit 0
