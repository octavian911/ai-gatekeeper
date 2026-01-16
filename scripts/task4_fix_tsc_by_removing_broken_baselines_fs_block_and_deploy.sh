#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"

echo "== Task 4 FIX: remove broken baselines-fs injected block (getFiles/req.user TS errors) + deploy =="
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"
echo

[[ -f "$INDEX_TS" ]] || { echo "ERROR: index.ts not found at $INDEX_TS" >&2; exit 1; }

cp -v "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");
const lines = src.split("\n");

function removeRouteBlockStartingAt(i) {
  // Remove from the route line until its matching end "});" using brace counting.
  let depth = 0;
  let started = false;
  let j = i;

  for (; j < lines.length; j++) {
    const ln = lines[j];

    // crude brace counting (good enough for Express handlers)
    for (const ch of ln) {
      if (ch === "{") { depth++; started = true; }
      if (ch === "}") depth--;
    }

    // Stop after we’ve seen braces and we hit a line ending a handler.
    if (started && depth <= 0 && /\}\)\s*;?\s*$/.test(ln)) {
      j++;
      break;
    }
  }

  // If brace counting fails, also bail out when we see a blank line after "});"
  // but above usually catches it.
  return { from: i, to: j };
}

// We remove ONLY the broken “baselines fs” stuff that was injected and causes:
// - bucket.getFiles()
// - req.user typed as AuthedReq.user
// This keeps your working upload + download + debug routes intact.
const removeRanges = [];

for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];

  const looksLikeBrokenBaselinesFsRoute =
    /app\.(get|post|delete|put)\(\s*["']\/baselines\/.*fs/.test(ln) ||
    /app\.(get|post|delete|put)\(\s*["']\/baselines\/fs/.test(ln) ||
    /app\.(get|post|delete|put)\(\s*["']\/baselines\/[^"']+\/metadata-fs/.test(ln);

  // Additionally, remove any helper/handler function blocks that reference getFiles(),
  // because getUploadBucket() returns string and that injected code was wrong.
  const lineMentionsGetFiles = ln.includes(".getFiles(") || ln.includes("getFiles(");

  if (looksLikeBrokenBaselinesFsRoute) {
    removeRanges.push(removeRouteBlockStartingAt(i));
    continue;
  }

  // If we see a helper function declaration and later it uses getFiles, remove it.
  // This is conservative: only triggers when the current line looks like a function start.
  if (/^(async\s+)?function\s+\w+Fs\s*\(/.test(ln)) {
    // look ahead 80 lines to see if this function uses getFiles or req.user
    const window = lines.slice(i, Math.min(lines.length, i + 80)).join("\n");
    if (window.includes(".getFiles(") || window.includes("req.user")) {
      // remove until matching "}" line (brace count)
      let depth = 0, started = false, j = i;
      for (; j < lines.length; j++) {
        const l2 = lines[j];
        for (const ch of l2) {
          if (ch === "{") { depth++; started = true; }
          if (ch === "}") depth--;
        }
        if (started && depth <= 0) { j++; break; }
      }
      removeRanges.push({ from: i, to: j });
    }
  }

  // Also remove any route blocks (even if not baselines/fs) that contain getFiles(), because those are the broken ones.
  if (/app\.(get|post|delete|put)\(/.test(ln)) {
    const window = lines.slice(i, Math.min(lines.length, i + 120)).join("\n");
    if (window.includes(".getFiles(") || window.includes("getFiles(") || window.includes("req.user")) {
      // BUT do not delete the known-working upload handlers:
      if (window.includes('app.post("/upload-multi-fs"') || window.includes('app.post("/baselines/upload-multi-fs"')) {
        continue;
      }
      // And do not delete /download or debug routes
      if (window.includes('app.get("/download"') || window.includes('app.get("/api/debug/') || window.includes('app.get("/api/health"')) {
        continue;
      }
      // If current block itself contains getFiles reference, remove it.
      if (window.includes(".getFiles(") || window.includes("getFiles(")) {
        removeRanges.push(removeRouteBlockStartingAt(i));
      }
    }
  }
}

// Merge and apply ranges in reverse order
removeRanges.sort((a,b) => a.from - b.from);
const merged = [];
for (const r of removeRanges) {
  if (!merged.length) merged.push(r);
  else {
    const last = merged[merged.length - 1];
    if (r.from <= last.to) last.to = Math.max(last.to, r.to);
    else merged.push(r);
  }
}

for (let k = merged.length - 1; k >= 0; k--) {
  const { from, to } = merged[k];
  lines.splice(from, Math.max(0, to - from));
}

// Collapse 3+ blank lines
let out = lines.join("\n").replace(/\n{3,}/g, "\n\n");
fs.writeFileSync(file, out, "utf8");

console.log("✅ Removed broken baselines-fs/getFiles blocks. Ranges removed:", merged.length);
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
echo "== DONE ✅ =="
echo "If build/deploy succeeded, we'll re-add Baselines FS endpoints cleanly next."
