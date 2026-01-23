#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step18b (PERMANENT): Restore Step18 backup + insert requireAuthV2Timeout after const app = express();"
echo "    Target: $FILE"

# 1) Restore latest Step18 backup (the one created right before the broken insert)
BACKUP="$(ls -1t "$FILE".bak_step18_* 2>/dev/null | head -n 1 || true)"
if [ -z "$BACKUP" ]; then
  echo "ERROR: No Step18 backup found ($FILE.bak_step18_*) to restore." >&2
  exit 1
fi

echo "==> Restoring from: $BACKUP"
cp -f "$BACKUP" "$FILE"

# 2) Sanity: ensure app exists
APP_LINE="$(grep -n 'const app = express();' "$FILE" | head -n 1 | cut -d: -f1 || true)"
if [ -z "$APP_LINE" ]; then
  echo "ERROR: Could not find line const app = express(); in $FILE" >&2
  exit 1
fi
echo "OK: found app at line $APP_LINE"

# 3) Insert middleware ONLY if missing, right after app declaration line
if grep -q "requireAuthV2Timeout" "$FILE"; then
  echo "OK: requireAuthV2Timeout already exists (skip insert)."
else
  echo "==> Inserting requireAuthV2Timeout after app declaration (safe TS scope)..."
  tmp="$(mktemp)"
  awk -v app_line="$APP_LINE" '
    NR==app_line {
      print $0
      print ""
      print "// ---- Step18b: Auth middleware with hard timeout (prevents hanging verifyIdToken) ----"
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
      print "// ---- End Step18b middleware ----"
      next
    }
    { print }
  ' "$FILE" > "$tmp"
  mv "$tmp" "$FILE"
  echo "OK: Inserted requireAuthV2Timeout."
fi

# 4) Rewire FS routes to use requireAuthV2Timeout
echo "==> Rewiring FS routes to requireAuthV2Timeout..."
sed -i \
  -e 's|app.get("/api/baselines/fs",[[:space:]]*requireAuthV2,|app.get("/api/baselines/fs", requireAuthV2Timeout,|g' \
  -e 's|app.get("/baselines/fs",[[:space:]]*requireAuthV2,|app.get("/baselines/fs", requireAuthV2Timeout,|g' \
  -e 's|app.get("/api/baselines/fs_download",[[:space:]]*requireAuthV2,|app.get("/api/baselines/fs_download", requireAuthV2Timeout,|g' \
  -e 's|app.get("/baselines/fs_download",[[:space:]]*requireAuthV2,|app.get("/baselines/fs_download", requireAuthV2Timeout,|g' \
  "$FILE"

echo "==> Sanity: confirm middleware + routes"
grep -nE 'requireAuthV2Timeout|app\.get\("/api/baselines/fs"|app\.get\("/baselines/fs"|fs_download' "$FILE" | head -n 60

# 5) Lint/build/deploy
echo "==> ESLint auto-fix (index.ts only)"
cd "$ROOT/functions" || exit 1
npx eslint src/index.ts --fix --ext .ts --config .eslintrc.deploy.cjs >/dev/null 2>&1 || true

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step18b DONE."
echo
echo "Test (should NOT hang with 0 bytes forever):"
echo '  BASE="https://api-cbkg2trx7q-uc.a.run.app"'
echo '  echo "Paste fresh token:"; IFS= read -r JWT'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs_debug?t=$(date +%s)" | head -n 40'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
