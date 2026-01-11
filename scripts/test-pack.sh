#!/bin/bash

set -e

echo "Building packages..."
cd packages/core
npm install
npm run build
npm test -- evidence.test.ts

echo ""
echo "✓ All evidence pack tests passed!"
