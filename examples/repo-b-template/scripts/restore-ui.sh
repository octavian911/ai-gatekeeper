#!/bin/bash

# UI Restoration Script
# Restores the original login page from backup

set -e

if [ -f "app/login/page.tsx.bak" ]; then
  echo "🔄 Restoring original UI..."
  mv app/login/page.tsx.bak app/login/page.tsx
  echo "✅ UI restored to original state"
  echo ""
  echo "Next steps:"
  echo "1. Rebuild: npm run build"
  echo "2. Restart: npm start"
  echo "3. Run gate: npx ai-gate run --baseURL http://localhost:3000"
  echo ""
  echo "Expected result: All screens pass ✓"
else
  echo "❌ No backup file found at app/login/page.tsx.bak"
  echo "UI may not have been broken using break-ui.sh"
fi
