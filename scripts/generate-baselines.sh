#!/bin/bash

set -e

echo "🚀 Generating baselines for demo app..."

cd "$(dirname "$0")/.."

echo "📦 Installing dependencies..."
pnpm install

echo "🏗️  Building packages..."
pnpm build

echo "🌐 Starting demo app..."
cd examples/demo-app
pnpm demo:start &
APP_PID=$!

cleanup() {
  echo "🛑 Stopping demo app..."
  kill $APP_PID 2>/dev/null || true
}
trap cleanup EXIT

echo "⏳ Waiting for app to be ready..."
npx wait-on http://localhost:5173 -t 30000

echo "📸 Generating baselines..."
cd ../..
pnpm gate baseline

echo "✅ Baselines generated successfully!"
echo "📁 Check the baselines/ directory for generated files"
