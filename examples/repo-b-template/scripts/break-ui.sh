#!/bin/bash

# Intentional UI Breaking Script
# This script modifies the login page to demonstrate AI Gatekeeper catching visual regressions

set -e

echo "🔧 Breaking UI: Changing login button text..."

sed -i.bak 's/Sign in/Log In Now/g' app/login/page.tsx

echo "✅ UI broken! Changes made:"
echo "   - Login button text: 'Sign in' → 'Log In Now'"
echo ""
echo "Next steps:"
echo "1. Rebuild: npm run build"
echo "2. Restart: npm start"
echo "3. Run gate: npx ai-gate run --baseURL http://localhost:3000"
echo ""
echo "Expected result: Visual regression detected ❌"
echo ""
echo "To restore: mv app/login/page.tsx.bak app/login/page.tsx"
