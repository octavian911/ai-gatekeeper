#!/usr/bin/env bash
set -euo pipefail

cd ~/ai-gatekeeper

echo "== 0) Current status =="
git status -sb
echo

echo "== 1) Show diff summary (so you can sanity-check quickly) =="
git diff --stat
echo

echo "== 2) Stage REQUIRED config/runtime fixes =="
git add .firebaserc firebase.json frontend/main.tsx frontend/firebaseAppCheck.ts

echo "== 3) (Optional) Show staged diff =="
git diff --staged --stat
echo

echo "== 4) Commit required fixes =="
git commit -m "Fix: stabilize hosting + entrypoint + auth headers" || true

echo "== 5) Remove local one-off scripts (keep repo clean) =="
rm -f \
  apply-uploadpanel-and-api-proxy-node.sh \
  apply-uploadpanel-safe.sh \
  fix-api-rewrites.sh \
  fix-hosting-target-mapping.sh \
  make-firebase-app-only.sh \
  task1-hosting-proxy.sh \
  task2c-post-upload.sh \
  task3a-locate-upload-ui.sh \
  task3a2-find-baselines-in-dist.sh \
  task3a3-find-real-ui.sh || true

rm -f scripts/fix-api-prefix-and-deploy.sh || true
rm -f scripts/fix-auth-headers-and-deploy.sh || true
rm -f scripts/task3a_fix_build_deploy.sh || true

# keep only the “good” scripts if you want:
# scripts/guard-keep-as-is.sh
# scripts/next-smoke.sh
# scripts/fix-api-prefix-permanent.sh

echo "== 6) If UploadPanel.tsx is still modified, DO NOT auto-commit it. Show diff and decide =="
if git diff --name-only | grep -q '^frontend/src/components/UploadPanel\.tsx$'; then
  echo "UploadPanel.tsx is modified. Showing diff (first 200 lines):"
  git diff -- frontend/src/components/UploadPanel.tsx | sed -n '1,200p'
  echo
  echo "Decision:"
  echo "  - If these changes were intentional:   git add frontend/src/components/UploadPanel.tsx && git commit -m \"Fix: upload panel\""
  echo "  - If not intentional:                  git restore frontend/src/components/UploadPanel.tsx"
else
  echo "UploadPanel.tsx not modified."
fi
echo

echo "== 7) Push commits =="
git push

echo
echo "== DONE =="
git status -sb
