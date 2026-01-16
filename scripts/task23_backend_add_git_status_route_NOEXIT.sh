#!/usr/bin/env bash
# NOEXIT: always exits 0
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
INDEX_TS="$ROOT_DIR/functions/src/index.ts"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task23_backend_$(ts)"
mkdir -p "$BACKUP"

echo "ROOT: $ROOT_DIR"
echo "PROJECT: $PROJECT_ID"
echo "INDEX_TS: $INDEX_TS"
echo "BACKUP: $BACKUP"

if [ ! -f "$INDEX_TS" ]; then
  echo "WARN: index.ts not found. Exiting 0."
  exit 0
fi

cp -a "$INDEX_TS" "$BACKUP/" 2>/dev/null || true

INDEX_TS="$INDEX_TS" node <<'NODE'
const fs = require("fs");
const f = process.env.INDEX_TS;
if (!f || !fs.existsSync(f)) process.exit(0);

let s = fs.readFileSync(f, "utf8");

const MARK = "__AGK_GIT_STATUS_ROUTE__";
if (s.includes(MARK)) {
  console.log("git-status route already present. No change.");
  process.exit(0);
}

/**
 * We add handler for the REAL internal route space: /baselines/git-status
 * Your prefix normalizer already maps:
 *   /api/api/baselines/* -> /baselines/*
 *   /api/baselines/*     -> /baselines/*
 */
const anchor = "DEBUG_HEADERS";
const idx = s.indexOf(anchor);
if (idx < 0) {
  console.log("WARN: insertion anchor DEBUG_HEADERS not found. No change.");
  process.exit(0);
}

const insert = `
/** ${MARK}
 * Health endpoint used by UI (git status / build info)
 * Public on purpose (returns JSON, never 404/HTML).
 */
app.get(["/baselines/git-status"], async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    // If you have envs like GIT_SHA / COMMIT_SHA set in build, expose them:
    const sha = process.env.GIT_SHA || process.env.COMMIT_SHA || process.env.SOURCE_VERSION || "unknown";
    return res.status(200).json({ ok: true, sha });
  } catch (e) {
    return res.status(200).json({ ok: true, sha: "unknown" });
  }
});
`;

s = s.slice(0, idx) + insert + s.slice(idx);
fs.writeFileSync(f, s, "utf8");
console.log("Inserted /baselines/git-status ✅");
NODE

echo
echo "== Lint/build/deploy functions:api (best-effort) =="
( cd "$ROOT_DIR/functions" && npm run lint -- --fix ) || true
( cd "$ROOT_DIR/functions" && npm run build ) || true
( cd "$ROOT_DIR" && firebase deploy --only functions:api --project "$PROJECT_ID" ) || true

echo
echo "== Probes =="
echo "-- git-status via /api/api/baselines/git-status (should be 200 JSON, not HTML 404)"
curl -sS -i "https://app.ai-gatekeeper.ca/api/api/baselines/git-status?t=$(date +%s)" | head -n 30 || true

echo "DONE backend (NOEXIT)."
exit 0
NODE
