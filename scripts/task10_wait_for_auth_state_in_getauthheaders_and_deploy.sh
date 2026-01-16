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

echo "== Task 10: Make getAuthHeaders wait for Firebase auth state =="
echo "TARGET: $TARGET"

cp -f "$TARGET" "$TARGET.bak.$(date +%Y%m%d-%H%M%S)"

node - "$TARGET" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// Ensure firebase/auth import includes getAuth + onAuthStateChanged
const authImportRe = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']firebase\/auth["'];?/;
if (authImportRe.test(s)) {
  s = s.replace(authImportRe, (m, inner) => {
    const parts = inner.split(",").map(x => x.trim()).filter(Boolean);
    if (!parts.includes("getAuth")) parts.push("getAuth");
    if (!parts.includes("onAuthStateChanged")) parts.push("onAuthStateChanged");
    return `import { ${parts.join(", ")} } from "firebase/auth";`;
  });
} else {
  // Add a new import near the top
  const lines = s.split("\n");
  let insertAt = 0;
  while (insertAt < lines.length && lines[insertAt].startsWith("import")) insertAt++;
  lines.splice(insertAt, 0, `import { getAuth, onAuthStateChanged } from "firebase/auth";`);
  s = lines.join("\n");
}

// Insert helper if missing
if (!s.includes("function __ensureAuthReady")) {
  const sig = "export async function getAuthHeaders";
  const idx = s.indexOf(sig);
  if (idx === -1) {
    console.error("ERROR: Could not find getAuthHeaders() signature.");
    process.exit(2);
  }

  const helper =
`\nlet __authReadyPromise: Promise<void> | null = null;
function __ensureAuthReady(): Promise<void> {
  if (__authReadyPromise) return __authReadyPromise;
  const auth = getAuth();
  __authReadyPromise = new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
  return __authReadyPromise;
}\n\n`;

  s = s.slice(0, idx) + helper + s.slice(idx);
}

// Replace getAuthHeaders() body (brace matching)
const sig = "export async function getAuthHeaders";
const start = s.indexOf(sig);
if (start === -1) {
  console.error("ERROR: Could not find getAuthHeaders() signature.");
  process.exit(3);
}
let i = s.indexOf("{", start);
if (i === -1) {
  console.error("ERROR: Could not find '{' after getAuthHeaders signature.");
  process.exit(4);
}

let brace = 0;
let inS=false, inD=false, inT=false, inLine=false, inBlock=false, esc=false;
for (; i < s.length; i++) {
  const c = s[i], n = s[i+1];
  if (inLine) { if (c === "\n") inLine=false; continue; }
  if (inBlock) { if (c==="*" && n==="/") { inBlock=false; i++; } continue; }
  if (!inS && !inD && !inT) {
    if (c==="/" && n==="/") { inLine=true; i++; continue; }
    if (c==="/" && n==="*") { inBlock=true; i++; continue; }
  }
  if (esc) { esc=false; continue; }
  if (c === "\\") { esc=true; continue; }
  if (!inD && !inT && c === "'") { inS=!inS; continue; }
  if (!inS && !inT && c === '"') { inD=!inD; continue; }
  if (!inS && !inD && c === "`") { inT=!inT; continue; }
  if (inS || inD || inT) continue;

  if (c === "{") brace++;
  if (c === "}") {
    brace--;
    if (brace === 0) { i++; break; }
  }
}
const fnEnd = i;

const replacement =
`export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // Wait for Firebase Auth to restore session before reading currentUser
  try {
    await __ensureAuthReady();
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

s = s.slice(0, start) + replacement + s.slice(fnEnd);

fs.writeFileSync(file, s, "utf8");
console.log("OK: getAuthHeaders now waits for auth state + uses ID token");
NODE

echo
echo "== Build frontend =="
npm --prefix "$FRONTEND_DIR" run build

echo
echo "== Deploy hosting =="
firebase deploy --only "hosting:$HOSTING_SITE"

echo
echo "== DONE ✅ =="
echo "Now re-test in Firefox Network: /api/baselines/fs must include Authorization: Bearer eyJ..."
