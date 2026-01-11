#!/usr/bin/env bash
set -euo pipefail

cd "$HOME/ai-gatekeeper" || exit 1

echo "==> (0) Ensure folders"
mkdir -p scripts/_scratch scripts

echo "==> (1) Move golden scripts into scripts/ (optional but cleaner)"
for f in safe_write.sh e2e_upload_autofix.sh e2e_upload_then_download_same_token.sh; do
  if [ -f "./$f" ]; then
    mv "./$f" "scripts/$f"
  fi
done

echo "==> (2) Restore important tracked scripts if they were moved/deleted"
# These were previously tracked, your move loop made them show as D (deleted).
# If they exist in _scratch, move them into scripts/ (keep them).
for f in security-check-ai-gatekeeper-ca.sh test-pack.sh verify-content-disposition.sh; do
  if [ -f "scripts/_scratch/$f" ]; then
    mv "scripts/_scratch/$f" "scripts/$f"
  fi

  # If git still thinks it's deleted and file isn't present, restore from HEAD.
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    if [ ! -f "$f" ] && [ ! -f "scripts/$f" ]; then
      git restore --source=HEAD -- "$f" || true
      [ -f "$f" ] && mv "$f" "scripts/$f"
    fi
  fi
done

echo "==> (3) Make _scratch + caches + backups ignored (permanent)"
touch .gitignore

add_ignore () {
  local line="$1"
  grep -qxF "$line" .gitignore 2>/dev/null || echo "$line" >> .gitignore
}

add_ignore ""
add_ignore "# Local scratch + backups"
add_ignore "scripts/_scratch/"
add_ignore "*.bak"
add_ignore "*.bak.*"
add_ignore ".firebase/"
add_ignore ".firebase/*"
add_ignore ""
add_ignore "# Build outputs (generated)"
add_ignore "frontend/dist/"
add_ignore ""
add_ignore "# Local env (do not commit secrets)"
add_ignore "frontend/.env.development"
add_ignore "frontend/.env.development.bak"
add_ignore "frontend/.env.*.local"

echo "==> (4) Stop tracking generated outputs/caches if they are currently tracked"
# This is the key step that prevents constant git noise.
if git ls-files --error-unmatch frontend/dist >/dev/null 2>&1; then
  git rm -r --cached frontend/dist || true
fi
if git ls-files --error-unmatch .firebase >/dev/null 2>&1; then
  git rm -r --cached .firebase || true
fi

echo "==> (5) Ensure scripts are executable"
chmod +x scripts/*.sh 2>/dev/null || true

echo "==> (6) Stage changes (excluding ignored files automatically)"
git add -A

echo "==> (7) Show final status + diffstat"
git status -sb
echo
git diff --cached --stat

echo
echo "✅ Cleanup staged."
echo "Next: commit it:"
echo "  git commit -m \"chore: repo hygiene (ignore build/cache, consolidate scripts)\""
