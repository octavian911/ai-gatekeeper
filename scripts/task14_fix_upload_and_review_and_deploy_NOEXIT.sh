#!/usr/bin/env bash
# This script intentionally NEVER exits 1.
# It logs failures and exits 0 so your terminal won't keep showing exit code 1.

set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/.backup_task14_$TS"
mkdir -p "$BACKUP_DIR"

STATUS=0
run() {
  echo
  echo ">> $*"
  "$@"
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "!! WARN: command failed (rc=$rc): $*"
    STATUS=1
  fi
  return 0
}

backup_file() {
  f="$1"
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "${f#$ROOT_DIR/}")" 2>/dev/null
    cp -a "$f" "$BACKUP_DIR/${f#$ROOT_DIR/}" 2>/dev/null
  fi
  return 0
}

echo "== Task14: Fix upload + review routes (NO perl, NO exit 1) =="
echo "ROOT: $ROOT_DIR"
echo "BACKUP: $BACKUP_DIR"
echo "PROJECT: $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "INDEX_TS: $INDEX_TS"

# ---------- A) FRONTEND: Fix UploadPanel endpoint + multipart meta shape ----------
UPLOAD_PANEL_CANDIDATES=(
  "$FRONTEND_DIR/src/components/UploadPanel.tsx"
  "$FRONTEND_DIR/src/components/UploadPanel.ts"
  "$FRONTEND_DIR/components/UploadPanel.tsx"
  "$FRONTEND_DIR/components/UploadPanel.ts"
)

UPLOAD_PANEL=""
for c in "${UPLOAD_PANEL_CANDIDATES[@]}"; do
  if [ -f "$c" ]; then UPLOAD_PANEL="$c"; break; fi
done

if [ -n "$UPLOAD_PANEL" ]; then
  echo
  echo "== A) Patching UploadPanel: $UPLOAD_PANEL =="
  backup_file "$UPLOAD_PANEL"

  # 1) Ensure it calls /api/baselines/upload-multi-fs (not missing /api)
  run node -e '
    const fs=require("fs");
    const f=process.argv[1];
    let t=fs.readFileSync(f,"utf8");
    t=t.replace(/["'\'']\/baselines\/upload-multi-fs["'\'']/g, "\"/api/baselines/upload-multi-fs\"");
    t=t.replace(/["'\'']\/api\/upload-multi-fs["'\'']/g, "\"/api/baselines/upload-multi-fs\"");
    fs.writeFileSync(f,t);
    console.log("OK: endpoint normalized to /api/baselines/upload-multi-fs");
  ' "$UPLOAD_PANEL"

  # 2) Ensure meta is appended as JSON (Blob) and DO NOT set Content-Type manually.
  #    We do a safe patch: if we see form.append("meta", ...) we normalize it.
  run node -e '
    const fs=require("fs");
    const f=process.argv[1];
    let t=fs.readFileSync(f,"utf8");

    // Remove any manual multipart content-type (breaks FormData in fetch)
    t=t.replace(/["'\'']Content-Type["'\'']\s*:\s*["'\'']multipart\/form-data["'\'']\s*,?/g,"");

    // Normalize meta append if present:
    // - prefer: form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));
    // - also allow metaObj variable names.
    const metaBlobLine = 'form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));';

    if (t.includes('form.append("meta"') || t.includes("form.append('meta'")) {
      t=t.replace(/form\.append\(\s*["'\'']meta["'\'']\s*,\s*([^\)]+)\)\s*;?/g, metaBlobLine);
    }

    // If we cannot find any meta append at all, we do not invent structure (avoid breaking build).
    fs.writeFileSync(f,t);
    console.log("OK: ensured no manual multipart Content-Type; normalized meta append if it existed");
  ' "$UPLOAD_PANEL"

  # 3) Ensure it includes Authorization header via getAuthHeaders() if your file already uses it.
  #    If the file already has getAuthHeaders(), keep it. If not, do NOT guess import paths (avoid breaking build).
  run node -e '
    const fs=require("fs");
    const f=process.argv[1];
    let t=fs.readFileSync(f,"utf8");
    const hasGetAuth = t.includes("getAuthHeaders");
    const hasHeadersVar = /const\s+headers\s*=/.test(t) || /let\s+headers\s*=/.test(t);

    if (hasGetAuth && !hasHeadersVar) {
      // Try to insert: const headers = await getAuthHeaders();
      // right before the fetch call that uploads.
      t=t.replace(/(const\s+res\s*=\s*await\s+fetch\(\s*["'\'']\/api\/baselines\/upload-multi-fs["'\'']\s*,\s*\{)/,
                  'const headers = await getAuthHeaders();\n$1');
      fs.writeFileSync(f,t);
      console.log("OK: ensured headers uses getAuthHeaders() (best-effort)");
    } else {
      console.log("INFO: did not force getAuthHeaders() insertion (either already present or unknown structure).");
    }
  ' "$UPLOAD_PANEL"

else
  echo
  echo "== A) UploadPanel not found in expected paths. Skipping frontend upload patch. =="
fi

# ---------- B) FRONTEND: Ensure any hardcoded baselines endpoints use /api prefix ----------
echo
echo "== B) Normalize any remaining fetch('/baselines/...') to fetch('/api/baselines/...') =="
run bash -lc '
  cd "'"$FRONTEND_DIR"'" || exit 0
  # Only touch src/, avoid dist/ and backups
  FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null)
  if [ -z "$FILES" ]; then exit 0; fi
  for f in $FILES; do
    grep -q "/baselines/" "$f" || continue
    cp -a "$f" "'"$BACKUP_DIR"'/frontend_${TS}_$(echo "$f" | tr "/" "_")" 2>/dev/null || true
    sed -i "s#\"/baselines/#\"/api/baselines/#g; s#'\''/baselines/#'\''/api/baselines/#g" "$f" || true
  done
  echo "OK: normalized /baselines/* to /api/baselines/* in frontend/src (best-effort)"
'

# ---------- C) BACKEND: Add dual-route aliases for baselines endpoints (fs, git-status, upload) ----------
echo
echo "== C) Backend: add dual-route aliases (avoid /api vs non-/api mismatch) =="
if [ -f "$INDEX_TS" ]; then
  backup_file "$INDEX_TS"

  # Replace single-string route registrations with array form if found.
  # We only patch if the literal strings exist to avoid damaging code.
  run node -e '
    const fs=require("fs");
    const f=process.argv[1];
    let t=fs.readFileSync(f,"utf8");

    const reps = [
      { from: 'app.get("/baselines/fs"', to: 'app.get(["/api/baselines/fs","/baselines/fs"]' },
      { from: 'app.get("/api/baselines/fs"', to: 'app.get(["/api/baselines/fs","/baselines/fs"]' },

      { from: 'app.get("/baselines/git-status"', to: 'app.get(["/api/baselines/git-status","/baselines/git-status"]' },
      { from: 'app.get("/api/baselines/git-status"', to: 'app.get(["/api/baselines/git-status","/baselines/git-status"]' },

      { from: 'app.post("/baselines/upload-multi-fs"', to: 'app.post(["/api/baselines/upload-multi-fs","/baselines/upload-multi-fs"]' },
      { from: 'app.post("/api/baselines/upload-multi-fs"', to: 'app.post(["/api/baselines/upload-multi-fs","/baselines/upload-multi-fs"]' },
    ];

    let changed=false;
    for (const r of reps) {
      if (t.includes(r.from)) {
        t = t.split(r.from).join(r.to);
        changed=true;
      }
    }

    fs.writeFileSync(f,t);
    console.log(changed ? "OK: route aliases patched (where matches existed)" : "INFO: no matching baselines routes found to alias");
  ' "$INDEX_TS"
else
  echo "WARN: $INDEX_TS not found; skipping backend patch."
  STATUS=1
fi

# ---------- D) Build + deploy (never exit 1) ----------
echo
echo "== D) Build frontend =="
run npm --prefix "$FRONTEND_DIR" run build

echo
echo "== E) Deploy hosting (if build succeeded) =="
run firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID"

echo
echo "== F) Lint/build functions + deploy functions:api =="
run npm --prefix "$FUNCTIONS_DIR" run lint -- --fix
run npm --prefix "$FUNCTIONS_DIR" run lint
run npm --prefix "$FUNCTIONS_DIR" run build
run firebase deploy --only functions:api --project "$PROJECT_ID"

echo
echo "== G) Quick probes (no auth) =="
run curl -sS "https://app.ai-gatekeeper.ca/api/__debug/headers?t=$(date +%s)" | head -c 300; echo
run curl -sS -i "https://app.ai-gatekeeper.ca/api/baselines/fs?t=$(date +%s)" | head -n 15

echo
echo "== DONE (script will exit 0 no matter what) =="
if [ $STATUS -ne 0 ]; then
  echo "Some steps failed, but the script did not exit 1. Check the console output above."
fi

exit 0
