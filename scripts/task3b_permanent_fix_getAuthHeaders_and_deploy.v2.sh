#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

APPCHECK_FILE=""
if [[ -f "$FRONTEND_DIR/firebaseAppCheck.ts" ]]; then
  APPCHECK_FILE="$FRONTEND_DIR/firebaseAppCheck.ts"
elif [[ -f "$FRONTEND_DIR/firebaseAppCheck.tsx" ]]; then
  APPCHECK_FILE="$FRONTEND_DIR/firebaseAppCheck.tsx"
else
  echo "ERROR: firebaseAppCheck.ts or firebaseAppCheck.tsx not found in $FRONTEND_DIR" >&2
  exit 1
fi

echo "== Task 3B Permanent Fix (v2): getAuthHeaders always returns Authorization Bearer token =="
echo "PROJECT_ID:   $PROJECT_ID"
echo "HOSTING_SITE: $HOSTING_SITE"
echo "APPCHECK:     $APPCHECK_FILE"
echo

cp -v "$APPCHECK_FILE" "$APPCHECK_FILE.bak.$(date +%Y%m%d-%H%M%S)"

# Pass path explicitly to node (no env reliance)
node - "$APPCHECK_FILE" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
if (!file) throw new Error("Missing file path arg to node patcher");

let s = fs.readFileSync(file, "utf8");

function ensureImport(from, names) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${from}["'];`);
  const m = s.match(re);
  if (m) {
    const existing = m[1].split(",").map(x => x.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existing, ...names]));
    s = s.replace(re, `import { ${merged.join(", ")} } from "${from}";`);
    return;
  }
  const lines = s.split("\n");
  let insertAt = 0;
  for (let i=0;i<lines.length;i++){
    if (lines[i].startsWith("import ")) insertAt = i+1;
    else break;
  }
  lines.splice(insertAt, 0, `import { ${names.join(", ")} } from "${from}";`);
  s = lines.join("\n");
}

ensureImport("firebase/auth", ["getAuth", "signInAnonymously"]);

// Remove any existing getAuthHeaders to avoid duplicates
s = s.replace(/export\s+async\s+function\s+getAuthHeaders\s*\([\s\S]*?\n}\n/g, "");

// Inject robust getAuthHeaders at end
const inject = `
/**
 * Always returns Authorization header for backend calls.
 * - Ensures Firebase Auth has a user (anonymous ok).
 * - Fetches an ID token and returns "Authorization: Bearer <token>".
 * If Anonymous Auth is NOT enabled in Firebase Console, this throws loudly.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const auth = getAuth();

  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e: any) {
      const msg = e?.message || String(e);
      throw new Error(
        "Auth not ready: could not sign in anonymously. " +
        "Enable Anonymous Auth in Firebase Console → Authentication → Sign-in method. " +
        "Original: " + msg
      );
    }
  }

  const user = auth.currentUser;
  if (!user) throw new Error("Auth not ready: no currentUser after sign-in.");

  const idToken = await user.getIdToken().catch((e: any) => {
    const msg = e?.message || String(e);
    throw new Error("Auth token fetch failed: " + msg);
  });

  return { Authorization: \`Bearer \${idToken}\` };
}
`;

s = s.trimEnd() + "\n\n" + inject + "\n";
fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched getAuthHeaders() in", file);
NODE

echo
echo "== Build frontend =="
cd "$FRONTEND_DIR"
npm run build

echo
echo "== Deploy hosting (publish new bundle) =="
cd "$ROOT_DIR"
firebase deploy --only "hosting:$HOSTING_SITE" --project "$PROJECT_ID"

echo
echo "== DONE ✅ =="
echo "Next:"
echo "1) Firebase Console → Authentication → Sign-in method → ENABLE Anonymous"
echo "2) Open https://$HOSTING_SITE.web.app/baselines"
echo "3) Upload a file"
echo "4) DevTools → Network → request headers MUST include Authorization: Bearer ..."
