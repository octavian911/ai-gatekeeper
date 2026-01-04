#!/bin/bash
set -e

echo "🔨 Building @ai-gate/cli..."

cd packages/cli

echo "📦 Cleaning previous builds..."
pnpm run clean || rm -rf dist

echo "🏗️  Building TypeScript..."
pnpm run build

echo "📋 Checking package contents..."
echo "Files that will be included in package:"
echo "  - dist/"
echo "  - README.md"
echo ""

echo "📦 Creating tarball..."
pnpm pack

TARBALL=$(ls -t ai-gate-cli-*.tgz | head -1)

if [ -z "$TARBALL" ]; then
  echo "❌ Error: Tarball not created"
  exit 1
fi

echo "✅ Package created: packages/cli/$TARBALL"
echo ""
echo "📤 To publish to npm:"
echo "   cd packages/cli"
echo "   npm publish $TARBALL"
echo ""
echo "🔗 To install from tarball:"
echo "   npm install -D ./packages/cli/$TARBALL"
echo "   # Or from URL:"
echo "   npm install -D https://github.com/YOUR-ORG/ai-gatekeeper/releases/download/v1.0.0/$TARBALL"
echo ""
echo "🧪 To test locally:"
echo "   cd /tmp/test-install"
echo "   npm init -y"
echo "   npm install -D $(pwd)/$TARBALL"
echo "   npx ai-gate --help"
