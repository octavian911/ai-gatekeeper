#!/bin/bash

# Export AI Gatekeeper Next.js Template Repository
# This script prepares the template files for publishing to GitHub

set -e

TEMPLATE_SOURCE="examples/repo-b-template"
TEMP_DIR="/tmp/ai-gate-template-nextjs"
REPO_URL="https://github.com/AI-Gatekeeper/ai-gate-template-nextjs.git"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI Gatekeeper Template Repository Export"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if source directory exists
if [ ! -d "$TEMPLATE_SOURCE" ]; then
  echo "❌ ERROR: Source directory not found: $TEMPLATE_SOURCE"
  echo "   Are you running this from the ai-gatekeeper repository root?"
  exit 1
fi

# Remove existing temp directory if it exists
if [ -d "$TEMP_DIR" ]; then
  echo "🗑️  Removing existing temp directory: $TEMP_DIR"
  rm -rf "$TEMP_DIR"
fi

# Create temp directory
echo "📁 Creating temp directory: $TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copy all files from template source to temp directory
echo "📋 Copying template files from $TEMPLATE_SOURCE..."
cp -r "$TEMPLATE_SOURCE"/* "$TEMP_DIR/"

# Copy hidden files (like .github)
if [ -d "$TEMPLATE_SOURCE/.github" ]; then
  cp -r "$TEMPLATE_SOURCE/.github" "$TEMP_DIR/"
  echo "   ✓ Copied .github/ directory"
fi

# Verify critical files exist
echo ""
echo "🔍 Verifying critical files..."

CRITICAL_FILES=(
  "README.md"
  "ai-gate.config.json"
  "package.json"
  "next.config.js"
  "tsconfig.json"
  "baselines/manifest.json"
  "baselines/login/baseline.png"
  "baselines/pricing/baseline.png"
  "scripts/break-ui.sh"
  "scripts/restore-ui.sh"
  "scripts/run-visual-test.sh"
  "app/layout.tsx"
  "app/login/page.tsx"
  "app/pricing/page.tsx"
)

MISSING_FILES=()
for file in "${CRITICAL_FILES[@]}"; do
  if [ ! -e "$TEMP_DIR/$file" ]; then
    MISSING_FILES+=("$file")
    echo "   ✗ Missing: $file"
  else
    echo "   ✓ $file"
  fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
  echo ""
  echo "❌ ERROR: Missing ${#MISSING_FILES[@]} critical file(s)"
  echo "   Please ensure all required files exist in $TEMPLATE_SOURCE"
  exit 1
fi

# Make scripts executable
echo ""
echo "🔧 Making scripts executable..."
chmod +x "$TEMP_DIR/scripts"/*.sh
echo "   ✓ Scripts are executable"

# Count files
FILE_COUNT=$(find "$TEMP_DIR" -type f | wc -l)
echo ""
echo "✅ Export complete!"
echo "   📦 Total files: $FILE_COUNT"
echo "   📂 Location: $TEMP_DIR"
echo ""

# Print next steps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Create the repository on GitHub:"
echo "   https://github.com/organizations/AI-Gatekeeper/repositories/new"
echo ""
echo "   Repository name: ai-gate-template-nextjs"
echo "   Visibility: Public"
echo "   Description: Next.js template with AI Gatekeeper visual regression testing pre-configured"
echo "   Do NOT initialize with README"
echo ""
echo "2️⃣  Navigate to the temp directory:"
echo "   cd $TEMP_DIR"
echo ""
echo "3️⃣  Initialize git and push:"
echo "   git init"
echo "   git add ."
echo "   git commit -m \"Initial commit: Next.js template with AI Gatekeeper\""
echo "   git remote add origin $REPO_URL"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "4️⃣  Enable template repository:"
echo "   Go to: https://github.com/AI-Gatekeeper/ai-gate-template-nextjs/settings"
echo "   Scroll to 'Template repository' section"
echo "   Check ✅ 'Template repository'"
echo "   Save changes"
echo ""
echo "5️⃣  Verify:"
echo "   Visit: https://github.com/AI-Gatekeeper/ai-gate-template-nextjs"
echo "   Confirm 'Use this template' button appears"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 For detailed instructions, see: TEMPLATE_REPO_PUBLISH_STEPS.md"
echo ""

# Optional: Open directory in file manager (macOS/Linux)
if command -v open &> /dev/null; then
  echo "💡 TIP: Run 'open $TEMP_DIR' to view files in Finder"
elif command -v xdg-open &> /dev/null; then
  echo "💡 TIP: Run 'xdg-open $TEMP_DIR' to view files in file manager"
fi

echo ""
