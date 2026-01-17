#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1
echo "==> Deduping agkTokenMeta in: $FILE"

node <<'NODE'
const fs = require("fs");
const path = require("path");

const file = path.join(process.env.HOME, "ai-gatekeeper", "functions", "src", "index.ts");
let s = fs.readFileSync(file, "utf8");

// Remove overload-style signatures like: function agkTokenMeta(x: ...): ...;
s = s.replace(/^\s*function\s+agkTokenMeta\s*\([^)]*\)\s*:\s*[^;]+;\s*$/gm, "");

// Remove ANY implementations of agkTokenMeta (greedy enough to catch prior injected copies)
s = s.replace(/function\s+agkTokenMeta\s*\([\s\S]*?\n}\n/g, "");

// Insert ONE clean implementation before requireAuth (or near the top if requireAuth not found)
const impl =
`\nfunction agkTokenMeta(tok: string | null) {
  const t = (tok || "").trim();
  const dots = (t.match(/\\./g) || []).length;
  const len = t.length;
  const head = t.slice(0, 12);
  const tail = t.slice(Math.max(0, len - 12));
  return { len, dots, head, tail };
}\n\n`;

const marker = "async function requireAuth";
const idx = s.indexOf(marker);

if (idx >= 0) {
  s = s.slice(0, idx) + impl + s.slice(idx);
} else {
  // Fallback: insert after imports
  const firstNonImport = s.search(/\n(?!import )/);
  if (firstNonImport > 0) s = s.slice(0, firstNonImport) + impl + s.slice(firstNonImport);
  else s = impl + s;
}

fs.writeFileSync(file, s, "utf8");
console.log("OK: agkTokenMeta deduped + reinserted once:", file);
NODE

echo "==> Lint + Build"
cd "$ROOT/functions" || exit 1
npm run lint -- --fix
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ DONE"
