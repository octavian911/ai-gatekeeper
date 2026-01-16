#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

CANDIDATES=(
  "$FRONTEND_DIR/firebaseAppCheck.ts"
  "$FRONTEND_DIR/firebaseAppCheck.tsx"
  "$FRONTEND_DIR/src/firebaseAppCheck.ts"
  "$FRONTEND_DIR/src/firebaseAppCheck.tsx"
)

TARGET=""
for f in "${CANDIDATES[@]}"; do
  if [ -f "$f" ]; then TARGET="$f"; break; fi
done

if [ -z "$TARGET" ]; then
  echo "ERROR: Could not find firebaseAppCheck.ts/tsx"
  printf 'Tried:\n - %s\n' "${CANDIDATES[@]}"
  exit 1
fi

echo "== Task 9 (v3): Fix getAuthHeaders() to use Firebase ID token =="
echo "TARGET: $TARGET"

cp -f "$TARGET" "$TARGET.bak.$(date +%Y%m%d-%H%M%S)"

# IMPORTANT: 'node -' means "run code from stdin"
node - "$TARGET" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// Ensure import { getAuth } from "firebase/auth";
const hasImportLine = /from\s+["']firebase\/auth["']/.test(s);
const hasGetAuthSymbol = /\bgetAuth\b/.test(s);

if (!(hasImportLine && hasGetAuthSymbol)) {
  const lines = s.split(/\n/);
  let inserted = false;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s+/.test(lines[i])) {
      lines.splice(i + 1, 0, 'import { getAuth } from "firebase/auth";');
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    s = 'import { getAuth } from "firebase/auth";\n' + s;
  } else {
    s = lines.join("\n");
  }
}

// Replace getAuthHeaders() by locating signature and matching braces
const sig = "export async function getAuthHeaders";
const start = s.indexOf(sig);
if (start === -1) {
  console.error("ERROR: Could not find 'export async function getAuthHeaders' in file.");
  process.exit(2);
}

let i = s.indexOf("{", start);
if (i === -1) {
  console.error("ERROR: Could not find '{' after getAuthHeaders signature.");
  process.exit(3);
}

let brace = 0;
let inS = false, inD = false, inT = false;
let inLineC = false, inBlockC = false;
let esc = false;

for (; i < s.length; i++) {
  const c = s[i];
  const n = s[i + 1];

  if (inLineC) { if (c === "\n") inLineC = false; continue; }
  if (inBlockC) { if (c === "*" && n === "/") { inBlockC = false; i++; } continue; }

  if (!inS && !inD && !inT) {
    if (c === "/" && n === "/") { inLineC = true; i++; continue; }
    if (c === "/" && n === "*") { inBlockC = true; i++; continue; }
  }

  if (esc) { esc = false; continue; }
  if (c === "\\") { esc = true; continue; }

  if (!inD && !inT && c === "'") { inS = !inS; continue; }
  if (!inS && !inT && c === '"') { inD = !inD; continue; }
  if (!inS && !inD && c === "`") { inT = !inT; continue; }

  if (inS || inD || inT) continue;

  if (c === "{") brace++;
  if (c === "}") {
    brace--;
    if (brace === 0) { i++; break; }
  }
}

const fnEnd = i;
const fnStart = start;

const replacement =
`export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // Firebase Auth ID token -> Authorization: Bearer <ID_TOKEN>
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      if (idToken) headers["Authorization"] = \`Bearer \${idToken}\`;
    }
  } catch {
    // ignore
  }

  return headers;
}`;

s = s.slice(0, fnStart) + replacement + s.slice(fnEnd);
fs.writeFileSync(file, s, "utf8");
console.log("OK: Patched getAuthHeaders() to use Firebase ID token");
NODE

echo
echo "== Build frontend =="
npm --prefix "$FRONTEND_DIR" run build

echo
echo "== Deploy hosting =="
firebase deploy --only "hosting:$HOSTING_SITE"

echo
echo "== DONE ✅ =="
echo "Now: in Firefox -> Network -> /api/baselines/fs -> Request Headers should include Authorization: Bearer eyJ..."
