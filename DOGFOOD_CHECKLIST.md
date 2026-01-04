# How to Dogfood AI Gatekeeper in a Fresh Repo

Use this checklist to verify the customer installation flow works end-to-end.

## Prerequisites
- A test repository (Repo-B) separate from this monorepo
- Node.js 20+ installed
- Your app runs on localhost (e.g., port 3000)

## Installation Test

### Step 1: Build the CLI package
```bash
# In this monorepo
cd packages/cli
pnpm run build
pnpm pack
```

This creates `ai-gate-cli-1.0.0.tgz` in `packages/cli/`.

### Step 2: Install in test repo
```bash
# In Repo-B
cd /path/to/repo-b
npm install -D /path/to/this-monorepo/packages/cli/ai-gate-cli-1.0.0.tgz
```

### Step 3: Verify CLI is accessible
```bash
npx ai-gate --help
```

Expected output: CLI help text with commands listed.

## Baselines Setup Test

### Step 4: Create baselines structure
```bash
# In Repo-B
mkdir -p baselines/screen-01
```

### Step 5: Add manifest.json
```bash
cat > baselines/manifest.json << 'EOF'
{
  "baselines": [
    {
      "screenId": "screen-01",
      "name": "Homepage",
      "url": "/",
      "hash": "abc123"
    }
  ]
}
EOF
```

### Step 6: Add screen.json
```bash
cat > baselines/screen-01/screen.json << 'EOF'
{
  "name": "Homepage",
  "url": "/"
}
EOF
```

### Step 7: Add baseline screenshot
Take a screenshot of your app's homepage and save it as:
```bash
baselines/screen-01/baseline.png
```

Or use a placeholder:
```bash
# 1x1 red pixel PNG (base64)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==" | base64 -d > baselines/screen-01/baseline.png
```

## Local Run Test

### Step 8: Start your app
```bash
# In Repo-B (separate terminal)
npm run dev
# Ensure it's running on http://localhost:3000
```

### Step 9: Run the gate
```bash
# In Repo-B (another terminal)
npx ai-gate run --baseURL http://localhost:3000
```

Expected behavior:
- ✅ CLI connects to app
- ✅ Runs comparison for screen-01
- ✅ Creates `.ai-gate/evidence/run-TIMESTAMP/` folder
- ✅ Generates `report.html` and `summary.json`
- ✅ Exits with code 0 (PASS/WARN) or 1 (FAIL)

### Step 10: Check evidence output
```bash
ls -la .ai-gate/evidence/
open .ai-gate/evidence/run-*/report.html
```

Expected:
- HTML report opens in browser
- Shows screen comparison results
- Displays traffic light status (PASS/WARN/FAIL)

## Exit Code Test

### Step 11: Test PASS scenario
```bash
npx ai-gate run --baseURL http://localhost:3000
echo "Exit code: $?"
```

Expected: Exit code `0` if no changes detected.

### Step 12: Test FAIL scenario
```bash
# Modify your app's UI slightly (change text, color, etc.)
# Restart app
npx ai-gate run --baseURL http://localhost:3000
echo "Exit code: $?"
```

Expected: Exit code `1` if visual drift exceeds FAIL threshold.

## CI/CD Test (GitHub Actions)

### Step 13: Copy workflow file
```bash
# In Repo-B
mkdir -p .github/workflows
cp /path/to/this-monorepo/docs/github-actions/ai-gate.yml .github/workflows/
```

### Step 14: Customize for your app
Edit `.github/workflows/ai-gate.yml`:
- Change build command if needed
- Change start command if needed
- Update port if not 3000

### Step 15: Commit and push
```bash
git add .github/workflows/ai-gate.yml baselines/
git commit -m "Add AI Gatekeeper workflow"
git push
```

### Step 16: Create a PR
```bash
git checkout -b test-ai-gate
# Make a visual change to your app
git add .
git commit -m "Test visual change"
git push origin test-ai-gate
# Create PR on GitHub
```

### Step 17: Verify workflow runs
In GitHub:
1. Go to Actions tab
2. Find "AI Gatekeeper" workflow
3. Check it runs on the PR
4. Verify evidence artifact is uploaded
5. Confirm job fails if visual drift detected

Expected:
- ✅ Workflow triggers on PR
- ✅ Installs dependencies and Playwright
- ✅ Starts app successfully
- ✅ Runs AI Gatekeeper
- ✅ Uploads `.ai-gate/evidence/` as artifact
- ✅ Job succeeds (PASS/WARN) or fails (FAIL)

## Troubleshooting Tests

### Test missing baselines
```bash
# Temporarily rename baselines
mv baselines baselines-backup
npx ai-gate run --baseURL http://localhost:3000
```

Expected:
- ❌ Exits with code 1
- ❌ Error: "No baselines/manifest.json found"

```bash
# Restore baselines
mv baselines-backup baselines
```

### Test invalid baseURL
```bash
npx ai-gate run --baseURL http://invalid-url-12345.local
```

Expected:
- ❌ Exits with code 1
- ❌ Error about navigation failure

### Test specific screens
```bash
npx ai-gate run --baseURL http://localhost:3000 --screens screen-01
```

Expected:
- ✅ Only tests screen-01
- ✅ Skips other screens

## Success Criteria

✅ CLI installs without errors  
✅ `npx ai-gate` command works  
✅ Baselines load from filesystem  
✅ Gate runs and compares screenshots  
✅ Evidence written to `.ai-gate/evidence/`  
✅ HTML report generated and viewable  
✅ Exit code 0 for PASS/WARN  
✅ Exit code 1 for FAIL  
✅ GitHub Actions workflow executes  
✅ Workflow blocks PR merge on FAIL  
✅ Artifacts uploaded to GitHub  

## Clean Up

```bash
# In Repo-B
rm -rf .ai-gate/
rm -rf node_modules/@ai-gate/
git checkout main
git branch -D test-ai-gate
```

## Notes

- The CLI uses **filesystem baselines mode** (no backend required)
- Evidence is stored locally in `.ai-gate/evidence/`
- Add `.ai-gate/` to `.gitignore` in Repo-B
- The monorepo structure is NOT needed in Repo-B
- Customers only need the published `@ai-gate/cli` package
