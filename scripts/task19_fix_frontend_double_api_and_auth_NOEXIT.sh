#!/usr/bin/env bash
# NOEXIT: never returns exit code 1
set +e
set +H
set -o pipefail

ROOT="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONT="${FRONTEND_DIR:-$ROOT/frontend}"
PROJECT="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"
BACKUP="$ROOT/.backup_task19_frontend_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

echo "== Task19: Fix /api/api + force auth (NOEXIT) =="
echo "FRONT:  $FRONT"
echo "BACKUP: $BACKUP"
echo "PROJECT: $PROJECT"
echo "HOSTING_SITE: $HOSTING_SITE"

CLIENT="$FRONT/client.ts"
UPLOAD="$FRONT/src/components/UploadPanel.tsx"

# 1) Backup key files (if present)
[ -f "$CLIENT" ] && cp -a "$CLIENT" "$BACKUP/client.ts" 2>/dev/null || true
[ -f "$UPLOAD" ] && cp -a "$UPLOAD" "$BACKUP/UploadPanel.tsx" 2>/dev/null || true

# 2) Patch client.ts (THIS is the file your build uses)
if [ -f "$CLIENT" ]; then
  echo "== Patch: $CLIENT =="
  node - "$CLIENT" <<'NODE'
const fs = require("fs");
const f = process.argv[2];
let t = fs.readFileSync(f, "utf8");

// A) De-dupe any accidental /api/api in strings (hard stop)
t = t.replaceAll("/api/api/", "/api/");

// B) Make callTypedAPI safe: normalize final path so it never produces /api/api
// We do a best-effort injection: right before fetch(url,...), ensure url is deduped.
if (!t.includes("task19_dedupe_api")) {
  t = t.replace(
    /fetch\s*\(\s*([a-zA-Z0-9_$.]+)\s*,/m,
    (m, urlVar) => {
      return `// task19_dedupe_api\ntry { ${urlVar} = String(${urlVar}).replace(/^\\/api\\/api\\//, "/api/"); } catch(e) {}\n${m}`;
    }
  );
}

// C) Force auth header inside callTypedAPI if the file defines it.
// Insert a helper once, then insert header logic near fetch init usage.
if (!t.includes("async function __task19_getIdToken")) {
  t =
`// task19 helper (safe)\nasync function __task19_getIdToken(): Promise<string> {\n  try {\n    const mod: any = await import("firebase/auth");\n    const auth = mod.getAuth?.();\n    const u = auth?.currentUser;\n    if (!u) return \"\";\n    return await u.getIdToken?.(true);\n  } catch (e) {\n    return \"\";\n  }\n}\n\n` + t;
}

// Try to inject header logic near "init" usage (common in your generated client)
if (!t.includes("task19_attach_bearer")) {
  t = t.replace(
    /(const\s+init\s*=\s*[^;]+;)/,
    `$1\n// task19_attach_bearer\ntry {\n  const tok = await __task19_getIdToken();\n  if (tok) {\n    const h = new Headers((init as any).headers || {});\n    h.set(\"Authorization\", \"Bearer \" + tok);\n    (init as any).headers = h;\n  }\n} catch(e) {}\n`
  );
}

fs.writeFileSync(f, t);
console.log("Patched:", f);
NODE
else
  echo "WARN: missing $CLIENT (skipping)"
fi

# 3) Patch UploadPanel.tsx to ALWAYS call /api/baselines/upload-multi-fs (never /baselines/*)
if [ -f "$UPLOAD" ]; then
  echo "== Patch: $UPLOAD =="
  node - "$UPLOAD" <<'NODE'
const fs = require("fs");
const f = process.argv[2];
let t = fs.readFileSync(f, "utf8");

// De-dupe and normalize endpoint
t = t.replaceAll('"/api/api/', '"/api/');
t = t.replaceAll("'/api/api/", "'/api/");
t = t.replaceAll('"/baselines/', '"/api/baselines/');
t = t.replaceAll("'/baselines/", "'/api/baselines/");

// If it uses fetch for upload, ensure it's /api/baselines/upload-multi-fs
t = t.replace(/fetch\(\s*["']\/api\/baselines\/upload-multi-fs["']/g, 'fetch("/api/baselines/upload-multi-fs"');
t = t.replace(/fetch\(\s*["']\/baselines\/upload-multi-fs["']/g, 'fetch("/api/baselines/upload-multi-fs"');
t = t.replace(/fetch\(\s*["']\/api\/api\/baselines\/upload-multi-fs["']/g, 'fetch("/api/baselines/upload-multi-fs"');

fs.writeFileSync(f, t);
console.log("Patched:", f);
NODE
else
  echo "WARN: missing $UPLOAD (skipping)"
fi

# 4) Quick grep proof in SOURCE (not dist)
echo "== Check SOURCE for /api/api (should be empty) =="
grep -RIn "/api/api" "$FRONT/src" "$FRONT/client.ts" 2>/dev/null || true

# 5) Build + deploy
echo "== Build frontend =="
npm --prefix "$FRONT" run build || true

echo "== Deploy hosting:$HOSTING_SITE =="
firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT" || true

# 6) Verify LIVE deployed JS contains no /api/api
echo "== Verify LIVE JS has no /api/api =="
ASSET_PATH="$(curl -sS https://app.ai-gatekeeper.ca/baselines \
  | tr '"' '\n' \
  | grep -E '^/assets/index-.*\.js$' \
  | head -n 1)"
echo "Live asset: $ASSET_PATH"
if [ -n "$ASSET_PATH" ]; then
  curl -sS "https://app.ai-gatekeeper.ca${ASSET_PATH}" | grep -n "/api/api" | head -n 20 || true
else
  echo "WARN: could not detect asset path"
fi

echo "DONE task19 (NOEXIT)"
exit 0
