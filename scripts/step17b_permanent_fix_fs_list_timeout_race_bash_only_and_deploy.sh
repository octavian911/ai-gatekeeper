#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step17b (PERMANENT, bash-only): Rewrite __fsListHandler so Promise.race actually races"
echo "    Target: $FILE"

if [ ! -f "$FILE" ]; then
  echo "ERROR: Missing $FILE" >&2
  exit 1
fi

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step17b_$ts"
echo "==> Backup: $FILE.bak_step17b_$ts"

# 1) Find __fsListHandler start line
START="$(grep -nE '^const __fsListHandler\s*=\s*async\s*\(req:\s*any,\s*res:\s*any\)\s*=>\s*\{' "$FILE" | head -n 1 | cut -d: -f1 || true)"
if [ -z "${START:-}" ]; then
  echo "ERROR: Could not find __fsListHandler declaration in $FILE" >&2
  exit 1
fi
echo "==> Found __fsListHandler at line: $START"

# 2) Find the end of the handler block: first line that is exactly '};' after START
OFFSET_END="$(sed -n "${START},\$p" "$FILE" | grep -nE '^\};\s*$' | head -n 1 | cut -d: -f1 || true)"
if [ -z "${OFFSET_END:-}" ]; then
  echo "ERROR: Could not find end of __fsListHandler block (line matching ^};$) after line $START" >&2
  exit 1
fi
END="$((START + OFFSET_END - 1))"
echo "==> Handler block spans: $START..$END"

# 3) Write replacement handler to a temp file
REPL="$(mktemp)"
cat > "$REPL" <<'TS'
const __fsListHandler = async (req: any, res: any) => {
  const uid = req.uid as string;
  const t0 = Date.now();

  const limitRaw = req.query?.limit ? String(req.query.limit) : "20";
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 20));

  const pageTokenRaw = req.query?.pageToken ? String(req.query.pageToken) : "";
  const pageToken = pageTokenRaw.trim() ? pageTokenRaw.trim() : undefined;

  const prefix = `uploads/${uid}/`;
  const TIMEOUT_MS = 8000;

  try {
    const bucketName = getUploadBucket();
    const bucket = admin.storage().bucket(bucketName);

    // IMPORTANT: do NOT await getFiles() before Promise.race.
    const listPromise: any = bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken,
      autoPaginate: false,
    });

    const timeoutPromise: any = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("fs_list_timeout")), TIMEOUT_MS)
    );

    const result: any = await Promise.race([listPromise, timeoutPromise]);

    const files: any[] = (result && result[0]) ? result[0] : [];
    const apiResp: any = (result && result[2]) ? result[2] : {};
    const nextPageToken: any = apiResp?.nextPageToken || null;

    const out = (files || []).map((f: any) => ({
      name: f.name,
      size: Number(f.metadata?.size || 0),
      updated: f.metadata?.updated || null,
      // Normalize to /baselines alias so frontend can be consistent:
      downloadUrl: `/baselines/fs_download?name=${encodeURIComponent(f.name)}`,
    }));

    return res.json({
      ok: true,
      uid,
      prefix,
      count: out.length,
      files: out,
      nextPageToken,
      elapsedMs: Date.now() - t0,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("fs_list_timeout")) {
      return res.status(504).json({ ok: false, error: "fs_list_timeout", elapsedMs: Date.now() - t0 });
    }
    console.error("[fs] error", { message: msg });
    return res.status(500).json({ ok: false, error: "fs_list_failed", detail: msg });
  }
};
TS

# 4) Replace the original handler block using awk by line range
TMP_OUT="$(mktemp)"
awk -v s="$START" -v e="$END" -v repl="$REPL" '
  NR==s {
    while ((getline line < repl) > 0) print line
    close(repl)
    next
  }
  NR>s && NR<=e { next }
  { print }
' "$FILE" > "$TMP_OUT"

mv -f "$TMP_OUT" "$FILE"
rm -f "$REPL"
echo "OK: __fsListHandler replaced."

# 5) Ensure routes use __fsListHandler
# Replace any existing /api/baselines/fs route line (single-line form) OR create if missing.
if grep -qE 'app\.get\("/api/baselines/fs"' "$FILE"; then
  sed -i -E 's@^app\.get\("/api/baselines/fs".*$@app.get("/api/baselines/fs", requireAuthV2, __fsListHandler);@' "$FILE"
else
  echo "WARN: /api/baselines/fs route not found; inserting near other baselines routes." >&2
  # Insert after first occurrence of fs_debug route
  awk '
    { print }
    $0 ~ /app\.get\("\/api\/baselines\/fs_debug"/ && !done {
      print "app.get(\"/api/baselines/fs\", requireAuthV2, __fsListHandler);"
      done=1
    }
  ' "$FILE" > "$TMP_OUT" && mv -f "$TMP_OUT" "$FILE"
fi

if grep -qE 'app\.get\("/baselines/fs"' "$FILE"; then
  sed -i -E 's@^app\.get\("/baselines/fs".*$@app.get("/baselines/fs", requireAuthV2, __fsListHandler);@' "$FILE"
else
  # Insert immediately after /api/baselines/fs
  awk '
    { print }
    $0 ~ /app\.get\("\/api\/baselines\/fs", requireAuthV2, __fsListHandler\);/ && !done {
      print "app.get(\"/baselines/fs\", requireAuthV2, __fsListHandler);"
      done=1
    }
  ' "$FILE" > "$TMP_OUT" && mv -f "$TMP_OUT" "$FILE"
fi

echo "==> Sanity: show fs routes + handler"
grep -nE 'const __fsListHandler|app\.get\("\/api\/baselines\/fs"|app\.get\("\/baselines\/fs"' "$FILE" || true

# 6) ESLint auto-fix for formatting, then build + deploy
cd "$ROOT/functions" || exit 1
echo "==> ESLint auto-fix (index.ts)"
npx eslint --fix "src/index.ts" --config .eslintrc.deploy.cjs >/dev/null 2>&1 || true

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step17b DONE"
echo ""
echo "Test: this MUST return within ~10s as JSON 200 or JSON 504 (not plain-text upstream timeout):"
echo '  BASE="https://api-cbkg2trx7q-uc.a.run.app"'
echo '  echo "Paste fresh Firebase ID token:"; IFS= read -r JWT'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
