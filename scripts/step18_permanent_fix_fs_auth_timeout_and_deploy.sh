#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step18 (PERMANENT): Add auth timeout middleware and rewire FS routes"
echo "    Target: $FILE"

if [ ! -f "$FILE" ]; then
  echo "ERROR: missing $FILE" >&2
  exit 1
fi

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step18_$ts"
echo "==> Backup: $FILE.bak_step18_$ts"

# 1) Insert requireAuthV2Timeout once (idempotent)
if grep -q "requireAuthV2Timeout" "$FILE"; then
  echo "OK: requireAuthV2Timeout already exists (skip insert)."
else
  echo "==> Inserting requireAuthV2Timeout before Baselines FS endpoints block..."
  tmp="$(mktemp)"
  awk '
    BEGIN { inserted=0 }
    /Baselines FS endpoints/ && inserted==0 {
      print ""
      print "// ---- Step18: Auth middleware with hard timeout (prevents hanging verifyIdToken) ----"
      print "const requireAuthV2Timeout = async (req: any, res: any, next: any) => {"
      print "  const AUTH_TIMEOUT_MS = Number(process.env.AUTH_TIMEOUT_MS || 8000);"
      print "  try {"
      print "    const h = String(req.headers?.authorization || \"\");"
      print "    const m = h.match(/^Bearer\\s+(.+)$/i);"
      print "    const token = m ? m[1] : \"\";"
      print "    if (!token || token.split(\".\").length !== 3) {"
      print "      return res.status(401).json({ ok: false, error: \"unauthorized\", detail: \"Missing/invalid Bearer token\" });"
      print "    }"
      print "    const timeoutP = new Promise((_: any, reject: any) => setTimeout(() => reject(new Error(\"auth_timeout\")), AUTH_TIMEOUT_MS));"
      print "    const decoded: any = await Promise.race([admin.auth().verifyIdToken(token), timeoutP]);"
      print "    req.uid = decoded?.uid;"
      print "    if (!req.uid) {"
      print "      return res.status(401).json({ ok: false, error: \"unauthorized\", detail: \"No uid in token\" });"
      print "    }"
      print "    return next();"
      print "  } catch (e: any) {"
      print "    const msg = String(e?.message || e);"
      print "    if (msg.includes(\"auth_timeout\")) {"
      print "      return res.status(504).json({ ok: false, error: \"auth_timeout\", timeoutMs: Number(process.env.AUTH_TIMEOUT_MS || 8000) });"
      print "    }"
      print "    return res.status(401).json({ ok: false, error: \"unauthorized\", detail: msg });"
      print "  }"
      print "};"
      print "// ---- End Step18 middleware ----"
      print ""
      inserted=1
    }
    { print }
  ' "$FILE" > "$tmp"
  mv "$tmp" "$FILE"
  echo "OK: Inserted requireAuthV2Timeout."
fi

# 2) Rewire FS routes to use requireAuthV2Timeout (not requireAuthV2)
echo "==> Rewiring FS routes to requireAuthV2Timeout..."
sed -i \
  -e 's|app.get("/api/baselines/fs",[[:space:]]*requireAuthV2,|app.get("/api/baselines/fs", requireAuthV2Timeout,|g' \
  -e 's|app.get("/baselines/fs",[[:space:]]*requireAuthV2,|app.get("/baselines/fs", requireAuthV2Timeout,|g' \
  -e 's|app.get("/api/baselines/fs_download",[[:space:]]*requireAuthV2,|app.get("/api/baselines/fs_download", requireAuthV2Timeout,|g' \
  -e 's|app.get("/baselines/fs_download",[[:space:]]*requireAuthV2,|app.get("/baselines/fs_download", requireAuthV2Timeout,|g' \
  "$FILE"

echo "==> Sanity: show fs routes now"
grep -nE 'requireAuthV2Timeout|app\.get\("/api/baselines/fs"|app\.get\("/baselines/fs"|fs_download' "$FILE" || true

# 3) Lint/build/deploy
echo "==> ESLint auto-fix (index.ts only)"
cd "$ROOT/functions" || exit 1
npx eslint src/index.ts --fix --ext .ts --config .eslintrc.deploy.cjs >/dev/null 2>&1 || true

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step18 DONE."
echo
echo "Next test (should return headers + JSON within ~10s; either 200/504 JSON, NOT 0-byte hang):"
echo '  BASE="https://api-cbkg2trx7q-uc.a.run.app"'
echo '  echo "Paste fresh token:"; IFS= read -r JWT'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs_debug?t=$(date +%s)" | head -n 40'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
