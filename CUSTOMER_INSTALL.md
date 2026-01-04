# AI Gatekeeper - Customer Installation Guide

AI Gatekeeper catches visual regressions in your app before they reach production. Think of it as a **traffic light for your PRs**:
- 🟢 **PASS** - Ship it! No visual changes detected
- 🟡 **WARN** - Small changes detected, review recommended  
- 🔴 **FAIL** - Visual drift detected, blocks merge

## 60-Second Quickstart

1. **Install the CLI**
   ```bash
   npm install -D @ai-gate/cli
   ```

2. **Add baselines folder to your repo**
   ```bash
   mkdir -p baselines
   # Add your baseline screenshots here (see below)
   ```

3. **Run the gate locally**
   ```bash
   npx ai-gate run --baseURL http://localhost:3000
   ```

4. **Add to CI** (see GitHub Actions workflow below)

---

## Detailed Installation

### Option 1: Install from npm (Recommended)

```bash
# Install as a dev dependency
npm install -D @ai-gate/cli

# Or with pnpm
pnpm add -D @ai-gate/cli

# Or with yarn
yarn add -D @ai-gate/cli
```

### Option 2: Install from GitHub Release

```bash
# Install from tarball URL
npm install -D https://github.com/YOUR-ORG/ai-gatekeeper/releases/download/v1.0.0/ai-gate-cli-1.0.0.tgz
```

---

## Setting Up Baselines

AI Gatekeeper uses **filesystem-based baselines**. Your repo must have a `baselines/` folder with this structure:

```
baselines/
├── manifest.json          # Index of all baseline screens
├── screen-01/
│   ├── baseline.png       # Reference screenshot
│   └── screen.json        # Screen metadata
├── screen-02/
│   ├── baseline.png
│   └── screen.json
└── ...
```

### Creating Baselines

**Manual approach:**
1. Create the `baselines/` folder structure manually
2. Add your reference screenshots as `baseline.png` in each screen folder
3. Create `screen.json` files with metadata:
   ```json
   {
     "name": "Homepage",
     "url": "/",
     "tags": ["critical"]
   }
   ```
4. Create `manifest.json`:
   ```json
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
   ```

**Automated approach:**
Run your existing screenshot generation process and use the CLI to import:
```bash
npx ai-gate baseline add --from ./screenshots
```

---

## Running Locally

### Basic Usage

```bash
# Start your app first
npm run dev  # or whatever starts your app on localhost:3000

# Run the gate in another terminal
npx ai-gate run --baseURL http://localhost:3000
```

### Advanced Usage

```bash
# Test specific screens only
npx ai-gate run --baseURL http://localhost:3000 --screens screen-01,screen-05

# Custom output directory
npx ai-gate run --baseURL http://localhost:3000 --outDir ./custom-evidence

# View help
npx ai-gate run --help
```

### Understanding Results

After running, check:
- **Terminal output** - Quick summary with traffic light indicators
- **HTML report** - Open `.ai-gate/evidence/run-TIMESTAMP/report.html` in browser
- **Exit code** - `0` = pass/warn, `1` = fail (blocks CI)

---

## Running in CI (GitHub Actions)

### Copy-Paste Workflow

Create `.github/workflows/ai-gate.yml`:

```yaml
name: AI Gatekeeper

on:
  pull_request:
  push:
    branches: [main]

jobs:
  visual-regression:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
      
      - name: Build app
        run: npm run build
      
      - name: Start app
        run: |
          npm run start &
          npx wait-on http://localhost:3000 --timeout 60000
      
      - name: Run AI Gatekeeper
        run: npx ai-gate run --baseURL http://localhost:3000
      
      - name: Upload evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ai-gate-evidence
          path: .ai-gate/evidence/
          retention-days: 30
```

### Workflow Explanation

1. **Triggers** - Runs on every PR and push to main
2. **Setup** - Installs Node.js, dependencies, and Playwright
3. **Start app** - Builds and starts your app (adjust for your stack)
4. **Run gate** - Executes visual regression tests
5. **Upload evidence** - Saves screenshots/diffs as artifacts (even on failure)
6. **Block merge** - Job fails if gate status is FAIL

### Customization for Your Stack

**Next.js:**
```yaml
- name: Build and start
  run: |
    npm run build
    npm run start &
    npx wait-on http://localhost:3000
```

**Vite:**
```yaml
- name: Build and preview
  run: |
    npm run build
    npm run preview &
    npx wait-on http://localhost:4173

- name: Run gate
  run: npx ai-gate run --baseURL http://localhost:4173
```

**Custom port:**
```yaml
- name: Run gate
  run: npx ai-gate run --baseURL http://localhost:8080
```

---

## Troubleshooting

### "No baselines/manifest.json found"
**Problem:** The CLI can't find your baselines folder.

**Solution:**
- Ensure `baselines/` exists in your repo root
- Check that `baselines/manifest.json` exists
- Run `ls baselines/` to verify structure

### "No matching screens found"
**Problem:** The manifest is empty or screen IDs don't match.

**Solution:**
- Check `baselines/manifest.json` has entries
- Verify screen IDs match folder names in `baselines/`

### "Failed to navigate to URL"
**Problem:** The app isn't running or baseURL is wrong.

**Solution:**
- Ensure your app is running: `curl http://localhost:3000`
- Check the port matches your app's port
- In CI, verify `wait-on` succeeded before running gate

### "Port already in use" in CI
**Problem:** Port 3000 is already taken.

**Solution:**
```yaml
- name: Start app
  run: npm run start &
  env:
    PORT: 3456

- name: Run gate
  run: npx ai-gate run --baseURL http://localhost:3456
```

### Evidence not uploading in CI
**Problem:** Artifacts aren't showing in GitHub Actions.

**Solution:**
- Ensure path is `.ai-gate/evidence/` (matches CLI output)
- Use `if: always()` so artifacts upload even on failure
- Check Actions → Artifacts tab after workflow runs

---

## What Gets Created

When you run the gate, it creates:

```
.ai-gate/
└── evidence/
    └── run-1234567890/
        ├── report.html        # Visual HTML report
        ├── summary.json       # JSON summary
        └── per-screen/
            ├── screen-01/
            │   ├── expected.png
            │   ├── actual.png
            │   ├── diff.png   # Only if changes detected
            │   └── result.json
            └── ...
```

**Add to `.gitignore`:**
```gitignore
.ai-gate/
```

---

## Next Steps

- **Customize thresholds** - Edit baselines policy to adjust WARN/FAIL thresholds
- **Add masks** - Exclude dynamic regions (timestamps, live data) from comparisons
- **Tag screens** - Organize screens by criticality (e.g., `critical`, `minor`)
- **Review workflow** - Set up team review process for WARN results

---

## Support

- **GitHub Issues:** https://github.com/YOUR-ORG/ai-gatekeeper/issues
- **Documentation:** See `README.md` in this repo
- **CLI Help:** `npx ai-gate --help`
