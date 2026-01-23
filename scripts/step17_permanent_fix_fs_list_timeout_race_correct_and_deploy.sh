#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/ai-gatekeeper"
FILE="$ROOT/functions/src/index.ts"

cd "$ROOT" || exit 1

echo "==> Step17 (PERMANENT): Rewrite __fsListHandler so Promise.race actually races (no accidental await)"
echo "    Target: $FILE"

if [ ! -f "$FILE" ]; then
  echo "ERROR: Missing $FILE" >&2
  exit 1
fi

ts="$(date +%Y%m%d_%H%M%S)"
cp -f "$FILE" "$FILE.bak_step17_$ts"
echo "==> Backup: $FILE.bak_step17_$ts"

# Build a tiny perl patcher (still executed from bash; you asked for bash scripts only)
PATCH_PL="$(mktemp)"
cat > "$PATCH_PL" <<'PERL'
use strict;
use warnings;

my $file = $ARGV[0] or die "missing file\n";
local $/ = undef;

open my $fh, "<", $file or die "read $file: $!";
my $src = <$fh>;
close $fh;

my $needle = 'const __fsListHandler = async (req: any, res: any) => {';
if (index($src, $needle) < 0) {
  die "ERROR: Could not find __fsListHandler definition. Aborting.\n";
}

my $replacement = <<'TS';
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
      // Use /baselines alias so frontend can be consistent:
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

# Replace ONLY the __fsListHandler block body (from its declaration to the next "};" at same nesting)
# Non-greedy to avoid eating the whole file.
$src =~ s/const __fsListHandler = async \(req: any, res: any\) => \{\n.*?\n\};/$replacement/s
  or die "ERROR: Failed to replace __fsListHandler block.\n";

# Ensure routes exist and use __fsListHandler
if ($src !~ /app\.get\(\"\/api\/baselines\/fs\",[^\n]*__fsListHandler\);/) {
  # Try to locate an existing /api/baselines/fs route and rewrite it
  $src =~ s/app\.get\(\"\/api\/baselines\/fs\".*?\);\n/app.get(\"\/api\/baselines\/fs\", requireAuthV2, __fsListHandler);\n/s
    or die "ERROR: Could not find /api/baselines/fs route to rewire.\n";
}

if ($src !~ /app\.get\(\"\/baselines\/fs\",[^\n]*__fsListHandler\);/) {
  # If /baselines/fs route exists, rewrite; otherwise insert right after /api/baselines/fs
  if ($src =~ /app\.get\(\"\/baselines\/fs\"/) {
    $src =~ s/app\.get\(\"\/baselines\/fs\".*?\);\n/app.get(\"\/baselines\/fs\", requireAuthV2, __fsListHandler);\n/s
      or die "ERROR: Could not rewrite /baselines/fs route.\n";
  } else {
    $src =~ s/(app\.get\(\"\/api\/baselines\/fs\",[^\n]*__fsListHandler\);\n)/$1app.get(\"\/baselines\/fs\", requireAuthV2, __fsListHandler);\n/s
      or die "ERROR: Could not insert /baselines/fs route.\n";
  }
}

# Ensure /baselines/fs_download alias exists (you already had it, but keep it safe)
if ($src !~ /app\.get\(\"\/baselines\/fs_download\"/) {
  $src =~ s/(app\.get\(\"\/api\/baselines\/fs_download\"[\s\S]*?\);\n)/$1app.get(\"\/baselines\/fs_download\", requireAuthV2, async (req: any, res: any) => {\n  // alias: forward to the /api version\n  req.url = \"/api/baselines/fs_download\" + (req.url.includes(\"?\") ? req.url.substring(req.url.indexOf(\"?\")) : \"\");\n  return app.handle(req, res);\n});\n/s
    or die "ERROR: Could not insert /baselines/fs_download alias.\n";
}

open my $out, ">", $file or die "write $file: $!";
print $out $src;
close $out;

print "OK: __fsListHandler rewritten and routes ensured.\n";
PERL

perl "$PATCH_PL" "$FILE"
rm -f "$PATCH_PL"

echo "==> ESLint auto-fix (index.ts)"
cd "$ROOT/functions" || exit 1
npx eslint --fix "src/index.ts" --config .eslintrc.deploy.cjs >/dev/null || true

echo "==> Lint + Build"
npm run lint
npm run build

echo "==> Deploy functions:api"
cd "$ROOT" || exit 1
firebase deploy --only functions:api

echo "✅ Step17 DONE"
echo ""
echo "Next: test and VERIFY it returns within 10s (JSON 200 or JSON fs_list_timeout), never the plain-text 60s timeout:"
echo '  BASE="https://api-cbkg2trx7q-uc.a.run.app"'
echo '  echo "Paste fresh Firebase ID token:"; IFS= read -r JWT'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/api/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
echo '  curl --max-time 15 -sS -i -H "Authorization: Bearer $JWT" "$BASE/baselines/fs?limit=5&t=$(date +%s)" | head -n 120'
