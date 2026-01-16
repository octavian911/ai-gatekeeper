#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"

echo "== Task 11: Add /api/__debug/verify (firebase-admin verifyIdToken) =="
echo "INDEX_TS: $INDEX_TS"

if [ ! -f "$INDEX_TS" ]; then
  echo "ERROR: index.ts not found at $INDEX_TS"
  exit 1
fi

cp -f "$INDEX_TS" "$INDEX_TS.bak.$(date +%Y%m%d-%H%M%S)"

node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// Ensure firebase-admin import exists
if (!s.match(/from\s+["']firebase-admin["']/) && !s.match(/require\(["']firebase-admin["']\)/)) {
  // Insert after other imports
  const lines = s.split("\n");
  let insertAt = 0;
  while (insertAt < lines.length && lines[insertAt].startsWith("import")) insertAt++;
  lines.splice(insertAt, 0, `import * as admin from "firebase-admin";`);
  s = lines.join("\n");
}

// Ensure initializeApp exists (idempotent)
if (!s.includes("admin.initializeApp")) {
  // Put near top after imports
  const lines = s.split("\n");
  let insertAt = 0;
  while (insertAt < lines.length && lines[insertAt].startsWith("import")) insertAt++;
  lines.splice(insertAt, 0,
    "",
    "// Firebase Admin (idempotent init)",
    "try {",
    "  admin.initializeApp();",
    "} catch (e: any) {",
    "  // ignore if already initialized",
    "}",
    ""
  );
  s = lines.join("\n");
}

// Insert debug verify endpoint near existing /api/__debug/headers if possible
const marker = "/api/__debug/headers";
let idx = s.indexOf(marker);

const endpoint =
`
  // PUBLIC debug: verify Firebase ID token (returns why auth fails)
  app.get("/api/__debug/verify", async (req, res) => {
    const auth = String(req.headers.authorization || "");
    if (!auth.startsWith("Bearer ")) {
      return res.status(200).json({ ok: false, error: "no_bearer", authPrefix: auth.slice(0, 20) });
    }
    const token = auth.slice("Bearer ".length).trim();
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      return res.status(200).json({
        ok: true,
        uid: decoded.uid,
        aud: decoded.aud,
        iss: decoded.iss,
        iat: decoded.iat,
        exp: decoded.exp,
        email: decoded.email || null,
        firebase: decoded.firebase || null,
      });
    } catch (e) {
      const err = e || {};
      return res.status(200).json({
        ok: false,
        error: String(err.code || err.name || "verify_failed"),
        message: String(err.message || err),
      });
    }
  });
`;

if (idx !== -1) {
  // Insert after the headers endpoint block by searching forward for the next ");" close
  const after = s.indexOf("});", idx);
  if (after !== -1) {
    s = s.slice(0, after + 3) + endpoint + s.slice(after + 3);
  } else {
    s += "\n" + endpoint + "\n";
  }
} else {
  // Fallback: append near end
  s += "\n" + endpoint + "\n";
}

fs.writeFileSync(file, s, "utf8");
console.log("OK: inserted /api/__debug/verify");
NODE

echo
echo "== Deploy functions =="
firebase deploy --only functions:api

echo
echo "== DONE ✅ =="
echo "Now test in browser Console:"
echo "fetch('/api/__debug/verify?t='+Date.now()).then(r=>r.json()).then(console.log)"
