#!/bin/bash

set -e

echo "🔍 AI Output Gate - Setup Verification"
echo "======================================"
echo ""

echo "1️⃣  Checking pnpm installation..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Please install pnpm 8+"
    exit 1
fi
echo "✅ pnpm found: $(pnpm --version)"
echo ""

echo "2️⃣  Installing dependencies..."
pnpm install --frozen-lockfile
echo "✅ Dependencies installed"
echo ""

echo "3️⃣  Running linter..."
pnpm lint
echo "✅ Linting passed"
echo ""

echo "4️⃣  Checking code formatting..."
pnpm format:check
echo "✅ Formatting passed"
echo ""

echo "5️⃣  Type checking..."
pnpm typecheck
echo "✅ Type checking passed"
echo ""

echo "6️⃣  Building packages..."
pnpm build
echo "✅ Build successful"
echo ""

echo "7️⃣  Running tests..."
pnpm test
echo "✅ Tests passed"
echo ""

echo "8️⃣  Verifying CLI..."
pnpm gate --help > /dev/null
echo "✅ CLI works"
echo ""

echo "======================================"
echo "✨ All checks passed! Setup verified."
echo ""
echo "Next steps:"
echo "  1. cd examples/demo-app && pnpm dev"
echo "  2. pnpm gate baseline add"
echo "  3. pnpm gate run"
echo ""
