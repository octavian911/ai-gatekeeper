#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"
HOSTING_SITE="${HOSTING_SITE:-ai-gatekeeper-app}"

# Try common locations
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
  echo "ERROR: Could not find firebaseAppCheck.ts/tsx in frontend."
  echo "Searched:"
  printf ' - %s\n' "${CANDIDATES[@]}"
  exit 1
fi

echo "== Task 9: Fix getAuthHeaders() to use Firebase ID token =="
echo "TARGET: $TARGET"

cp -f "$TARGET" "$TARGET.bak.$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
import re, sys, pathlib

path = pathlib.Path(sys.argv[1])
s = path.read_text(encoding="utf-8")

# 1) Ensure we import getAuth from firebase/auth
if 'from "firebase/auth"' not in s and "from 'firebase/auth'" not in s:
    # insert after the first import line (best-effort)
    lines = s.splitlines(True)
    for i, line in enumerate(lines):
        if line.startswith("import "):
            lines.insert(i+1, 'import { getAuth } from "firebase/auth";\n')
            s = "".join(lines)
            break
    else:
        s = 'import { getAuth } from "firebase/auth";\n' + s

# 2) Replace getAuthHeaders function body
pat = re.compile(r'export\s+async\s+function\s+getAuthHeaders\s*\(\)\s*:\s*Promise<\s*Record<\s*string\s*,\s*string\s*>\s*>\s*\{.*?\n\}', re.S)

replacement = r'''export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // Firebase Auth ID token -> Authorization: Bearer <ID_TOKEN>
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
    }
  } catch {
    // ignore
  }

  // If you also use App Check elsewhere, keep that logic in this file (do not break it).
  // This function's primary job for the API is Authorization.
  return headers;
}'''

if not pat.search(s):
    print("ERROR: Could not locate getAuthHeaders() to patch. Open the file and confirm its exact signature.", file=sys.stderr)
    sys.exit(2)

s2 = pat.sub(replacement, s, count=1)
path.write_text(s2, encoding="utf-8")
print("OK: Patched getAuthHeaders()")
PY "$TARGET"

echo
echo "== Build frontend =="
npm --prefix "$FRONTEND_DIR" run build

echo
echo "== Deploy hosting =="
firebase deploy --only "hosting:$HOSTING_SITE"

echo
echo "== DONE ✅ =="
echo "Next: In Firefox -> Network -> /api/baselines/fs must include Authorization: Bearer eyJ..."
echo "Then run in Console:"
echo 'fetch("/api/__debug/headers?t="+Date.now()).then(r=>r.json()).then(console.log)'
