#!/usr/bin/env bash
# NOEXIT: always exits 0 (logs problems but won't terminate your terminal with code 1)
set +e
set +H
set -o pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
INDEX_TS="$ROOT_DIR/functions/src/index.ts"

ts(){ date +%Y%m%d-%H%M%S; }
BACKUP="$ROOT_DIR/.backup_task23_backend_v2_$(ts)"
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

// 1) Fix invalid raw marker line(s) like: DEBUG_HEADERS =====
s = s.replace(/^\s*DEBUG_HEADERS.*$/gm, (m) => {
  // If already commented, keep it.
  if (m.trim().startsWith("//") || m.trim().startsWith("/*")) return m;
  return "// " + m.trim();
});

// 2) Ensure we only insert once
const MARK = "__AGK_GIT_STATUS_ROUTE_V2__";
if (!s.includes(MARK)) {
  // Find a safe insertion point: right after "const app = express();"
  const m = s.match(/const\s+app\s*=\s*express\(\)\s*;\s*/);
  let insertPos = -1;
  if (m && m.index != null) insertPos = m.index + m[0].length;

  // fallback: after first "app.use("
  if (insertPos < 0) {
    const u = s.indexOf("app.use(");
    insertPos = u > -1 ? u : 0;
  }

  const insert = `
/** ${MARK}
 * Baselines health endpoint used by UI (git status / build info).
 * Returns JSON (never HTML 404).
 */
app.get(["/baselines/git-status"], async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const sha =
      process.env.GIT_SHA ||
      process.env.COMMIT_SHA ||
      process.env.SOURCE_VERSION ||
      "unknown";
    return res.status(200).json({ ok: true, sha });
  } catch (_e) {
    return res.status(200).json({ ok: true, sha: "unknown" });
  }
});
`;

  s = s.slice(0, insertPos) + insert + s.slice(insertPos);
  console.log("Inserted /baselines/git-status ✅");
} else {
  console.log("git-status route already present ✅");
}

fs.writeFileSync(f, s, "utf8");
NODE

echo
echo "== Lint/build/deploy functions:api (best-effort) =="
( cd "$ROOT_DIR/functions" && npm run lint -- --fix ) || echo "WARN: lint failed"
( cd "$ROOT_DIR/functions" && npm run build ) || echo "WARN: build failed"
( cd "$ROOT_DIR" && firebase deploy --only functions:api --project "$PROJECT_ID" ) || echo "WARN: deploy failed"

echo
echo "== Probe git-status via app.ai-gatekeeper.ca (should be 200 JSON after deploy) =="
curl -sS -i "https://app.ai-gatekeeper.ca/api/api/baselines/git-status?t=$(date +%s)" | head -n 35 || true

echo "DONE backend (NOEXIT)."
exit 0
