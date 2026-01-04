# AI Output Gate

**Visual regression gate preventing UI drift in AI-generated code.**

[![Flake Rate](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/flake-metrics.json)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/nightly-flake.yml)
[![PR Gate](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/pr-gate.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/pr-gate.yml)

Deterministic screenshot comparison for CI/CD with Playwright + pixel-diff engine. Phase 1 is CLI-based; zero SaaS dependencies.

---

> **⚡ TL;DR: Run `pnpm demo:full` to see visual regression detection in 60 seconds**
> 
> [📖 Full Demo Guide](./QUICKSTART_DEMO.md) | [📋 Demo Cheat Sheet](./DEMO_CHEATSHEET.md) | [📦 Delivery Summary](./QUICKSTART_DELIVERY.md)

---

## 🚀 60-Second Quickstart

**See the gate catch visual regressions:**

```bash
pnpm install
pnpm demo:seed      # Generate 3 baselines (20s)
pnpm demo:break-ui  # Introduce UI drift (instant)
pnpm demo:run       # Watch gate fail with diff evidence (15s)
```

**What you'll see:**
- ❌ Gate FAILED - Visual regressions detected
- 📦 Evidence pack with side-by-side diffs
- 🔍 Interactive HTML report showing exact pixel changes

👉 **[Full Quickstart Demo Guide →](./QUICKSTART_DEMO.md)**

---

## What This Tool Does

AI Output Gate captures pixel-perfect baseline screenshots of your frontend routes and validates them in CI to catch unintended visual changes from AI-generated code modifications. It enforces deterministic rendering (disabled animations, fixed viewport, network blocking, stable waits) to minimize flakes.

**Core capabilities:**
- 📸 Baseline screenshot capture and storage
- 🔍 Pixel-diff comparison with configurable thresholds
- 🎭 Dynamic element masking for timestamps/IDs
- 📦 Evidence pack generation (zipped, hashed screenshots)
- 🤖 GitHub Actions integration with PR comments
- 📊 HTML/JSON reporting

---

## 🎯 2-Click Layman Flow (For Code Reviewers)

**You're a non-technical reviewer who needs to verify AI-generated UI changes. Here's how:**

### Step 1: Click the PR Comment Link
When AI Gatekeeper runs on a PR, it posts a comment like this:

```markdown
🛡️ AI Output Gate - Visual Regression Summary

Status: ⚠️  REVIEW REQUIRED
Total Screens: 20
✅ Passed: 18
❌ Failed: 2

📦 Evidence: Download artifact to review visual changes
```

### Step 2: Download & Open the Report
1. Click **"Actions"** tab at top of PR
2. Click the workflow run (green checkmark or red X)
3. Scroll to **"Artifacts"** section at bottom
4. Click **"ai-gate-evidence"** to download ZIP file
5. Unzip the file anywhere on your computer
6. **Open `index.html`** in your browser

### Step 3: Review Visual Changes
The report shows:
- ✅ **Green screens**: No visual changes detected
- ❌ **Red screens**: Visual changes found
- 🖼️ **Side-by-side comparison**: Baseline vs New vs Diff

**You'll see exactly what changed visually** - no code knowledge required!

#### ✨ Works 100% Offline
No internet connection needed after download. All images are embedded in the ZIP.

---

## 15-Minute Onboarding

Get from zero to first visual regression gate in 15 minutes.

### Step 1: Install Dependencies (2 min)

```bash
# Clone repository
git clone <your-repo-url>
cd ai-output-gate

# Install dependencies
pnpm install
```

### Step 2: Start Demo App (1 min)

```bash
# Start the 20-route demo application
pnpm demo:start
```

The demo app will run at `http://localhost:5173` with 20 test routes.

### Step 3: Create Baselines (5 min)

**Option A: Use existing committed baselines**

Skip this step if baselines already exist in `/baselines/` and are committed to the repo.

**Option B: Import from PNG folder**

```bash
# Import PNG screenshots from a folder
pnpm gate baseline add --from /path/to/screenshots

# Or import with metadata
pnpm gate baseline add --from /path/to/screenshots --meta screens.json
```

**Option C: Capture fresh baselines (requires running app)**

```bash
# In a new terminal (with demo app still running):
pnpm generate:baselines
```

This captures baseline screenshots for all 20 routes and saves them to `/baselines/`.

### Step 4: Run the Gate (3 min)

```bash
# Run visual regression gate (with demo app running at localhost:5173)
pnpm gate run --baseURL http://localhost:5173
```

**Expected output:**
```
✓ PASS screen-01 - 100.00% match
✓ PASS screen-02 - 100.00% match
...
📊 Run Summary:
  Total:  20
  PASS: 20
  WARN: 0
  FAIL: 0

  Report: runs/run-XXXXXX/report.html
```

### Step 5: View HTML Report (1 min)

```bash
# Open the generated HTML report
open runs/run-*/report.html  # macOS
xdg-open runs/run-*/report.html  # Linux
```

The report shows:
- Visual diff for each screen
- Pass/Warn/Fail status
- Pixel difference metrics
- Side-by-side expected vs actual images

### Step 6: Test in GitHub PR (3 min)

1. **Push baselines to your repo:**
   ```bash
   git add baselines/
   git commit -m "Add baseline screenshots"
   git push origin main
   ```

2. **Create a test PR with a visual change:**
   ```bash
   git checkout -b test-visual-change
   # Make a small CSS change to demo app
   git commit -am "Test: change button color"
   git push origin test-visual-change
   ```

3. **Open PR on GitHub** - The `pr-gate.yml` workflow will:
   - Run visual regression gate
   - Post PR comment with results
   - Upload evidence artifact (report.html + screenshots)

**You're done!** 🎉 You now have a working visual regression gate.

---

## Policy Defaults

AI Output Gate uses a three-tier threshold system to evaluate visual differences. All screens are evaluated against both **diffPixelRatio** (percentage of different pixels) and **diffPixels** (absolute count). A screen fails if **either** threshold is exceeded.

### Default Thresholds (Standard Screens)

For a standard 1280×720 viewport (921,600 pixels):

| Status | Diff Pixel Ratio | Diff Pixels | Meaning |
|--------|------------------|-------------|---------|
| **PASS** | < 0.02% | < 250px | Acceptable rendering variance |
| **WARN** | 0.02% - 0.05% | 250px - 600px | Minor differences, review recommended |
| **FAIL** | ≥ 0.05% | ≥ 600px | Significant visual drift detected |

**Threshold Logic:**
- **WARN** if `diffPixelRatio ≥ 0.0002` **OR** `diffPixels ≥ 250`
- **FAIL** if `diffPixelRatio ≥ 0.0005` **OR** `diffPixels ≥ 600`

### Tag-Based Overrides

You can tag screens with `critical` or `noisy` to apply stricter or more lenient thresholds.

#### `critical` Tag - Stricter Thresholds

Use for login pages, checkout flows, or mission-critical screens where any visual change is significant.

| Status | Diff Pixel Ratio | Diff Pixels (1280×720) |
|--------|------------------|------------------------|
| **WARN** | ≥ 0.01% | ≥ 150px |
| **FAIL** | ≥ 0.03% | ≥ 400px |

```json
{
  "name": "Login Page",
  "url": "/login",
  "tags": ["critical"]
}
```

#### `noisy` Tag - More Lenient Thresholds

Use for dashboards with live data, charts, or dynamic content. **Requires masks** to be defined.

| Status | Diff Pixel Ratio | Diff Pixels (1280×720) |
|--------|------------------|------------------------|
| **WARN** | ≥ 0.03% | ≥ 350px |
| **FAIL** | ≥ 0.08% | ≥ 900px |

```json
{
  "name": "Analytics Dashboard",
  "url": "/analytics",
  "tags": ["noisy"],
  "masks": [
    { "type": "css", "selector": "[data-gate-mask]" }
  ]
}
```

**Note:** Screens tagged `noisy` **must** have at least one mask defined, or the gate will fail.

### Per-Screen Custom Thresholds

Override thresholds for individual screens:

```json
{
  "name": "Dashboard",
  "url": "/dashboard",
  "thresholds": {
    "warn": {
      "diffPixelRatio": 0.0003,
      "diffPixels": 300
    },
    "fail": {
      "diffPixelRatio": 0.0008,
      "diffPixels": 800
    }
  }
}
```

### Viewport Scaling

Pixel thresholds automatically scale based on viewport size to maintain consistent tolerance:

| Viewport | Total Pixels | WARN Threshold | FAIL Threshold |
|----------|--------------|----------------|----------------|
| 1280×720 | 921,600 | 250px | 600px |
| 1920×1080 | 2,073,600 | 560px | 1200px |
| 375×667 (mobile) | 250,125 | 150px | 300px |

Ratio thresholds remain constant regardless of viewport size.

---

## Troubleshooting

### Common Flake Causes

#### 1. **Dynamic Content (Timestamps, Clocks, Live Data)**

**Symptom:** Gate fails with small pixel differences on elements showing time, dates, or live-updating content.

**Solution:** Add masks to exclude dynamic elements from comparison.

```bash
# Automatic mask suggestion
pnpm gate masks suggest --baseURL http://localhost:5173 --screen screen-01

# Apply high-confidence suggestions automatically
pnpm gate masks suggest --baseURL http://localhost:5173 --apply
```

**Manual mask in `baselines/screen-01/screen.json`:**
```json
{
  "masks": [
    { "type": "css", "selector": "[data-testid='clock']" },
    { "type": "css", "selector": ".timestamp" }
  ]
}
```

Or use `data-gate-mask` attribute in your HTML:
```html
<div data-gate-mask>12:34:56 PM</div>
```

#### 2. **Font Rendering Differences**

**Symptom:** Slight pixel differences in text, especially on CI vs local runs.

**Solution:** Deterministic rendering is already enforced. If differences persist:
- Ensure fonts are bundled/self-hosted (not loaded from CDN)
- Use `font-display: block` to prevent FOUT
- Check CI browser cache is warmed up

#### 3. **Animation/Transition Timing**

**Symptom:** Random failures where elements appear mid-transition.

**Solution:** Already disabled by default. If issues persist:
- Check for JavaScript-based animations (not CSS)
- Increase `layoutStabilityMs` in screen config:

```json
{
  "waitForSelector": "[data-testid='content']",
  "layoutStabilityMs": 500
}
```

#### 4. **External Network Requests (Images, APIs)**

**Symptom:** Failures when external CDN/API responses vary.

**Solution:** Network is already blocked except localhost. Ensure all assets are:
- Served from `localhost` or `127.0.0.1`
- Bundled in `public/` folder
- Not loaded from external CDNs

#### 5. **Viewport/Browser Differences**

**Symptom:** Different screenshot sizes or rendering between local and CI.

**Solution:** Verify Playwright browser is installed:
```bash
pnpm exec playwright install chromium --with-deps
```

Ensure viewport is consistent in `screen.json`:
```json
{
  "viewport": { "width": 1280, "height": 720 }
}
```

### Using `masks suggest`

Automatically detect dynamic elements that should be masked:

```bash
# Analyze all screens
pnpm gate masks suggest --baseURL http://localhost:5173

# Analyze specific screen
pnpm gate masks suggest --baseURL http://localhost:5173 --screen screen-05

# Apply high-confidence suggestions (≥75%) automatically
pnpm gate masks suggest --baseURL http://localhost:5173 --apply

# Reload page between snapshots for better detection
pnpm gate masks suggest --baseURL http://localhost:5173 --reload
```

**What it detects:**
- Elements with changing text content (timestamps, counters)
- Elements with different bounding boxes
- High-confidence suggestions (≥75%) can be auto-applied with `--apply`

**Output:**
```
screen-01: Home Page
  📋 2 suggestion(s):
    ● [data-testid="clock"] (95% confidence)
       Text content changes between snapshots
    ○ .quote-text (65% confidence)
       Bounding box changes between snapshots
```

### Tagging Screens as `critical` or `noisy`

#### When to use `critical`:

Tag screens where **any** visual change is unacceptable:
- Login/signup pages
- Payment/checkout flows
- Legal/compliance pages
- Brand/marketing landing pages

```json
{
  "name": "Checkout Page",
  "url": "/checkout",
  "tags": ["critical"]
}
```

**Effect:** Stricter thresholds (WARN at 0.01%, FAIL at 0.03%)

#### When to use `noisy`:

Tag screens with **intentional** dynamic content that can't be masked:
- Live dashboards
- Real-time charts
- User-generated content feeds
- Analytics pages

```json
{
  "name": "Live Dashboard",
  "url": "/dashboard",
  "tags": ["noisy"],
  "masks": [
    { "type": "css", "selector": ".live-chart" }
  ]
}
```

**Effect:** More lenient thresholds (WARN at 0.03%, FAIL at 0.08%). **Requires at least one mask.**

---

## Org-wide Policy (.gate/policy.json)

Set strict organization-wide defaults for viewport, determinism, thresholds, and enforcement rules. This ensures consistent testing across all screens while allowing per-screen overrides with proper justification.

### Quick Start

Create `.gate/policy.json` in your repository root:

```json
{
  "schemaVersion": 1,
  "defaults": {
    "viewport": { "width": 1280, "height": 720 },
    "determinism": {
      "browser": "chromium",
      "locale": "en-US",
      "timezoneId": "UTC",
      "disableAnimations": true,
      "blockExternalNetwork": true,
      "waitUntil": "networkidle"
    },
    "thresholds": {
      "standard": {
        "warn": { "diffPixelRatio": 0.0002, "diffPixels": 250 },
        "fail": { "diffPixelRatio": 0.0005, "diffPixels": 600 }
      },
      "critical": {
        "warn": { "diffPixelRatio": 0.0001, "diffPixels": 150 },
        "fail": { "diffPixelRatio": 0.0003, "diffPixels": 400 }
      },
      "noisy": {
        "warn": { "diffPixelRatio": 0.0003, "diffPixels": 350 },
        "fail": { "diffPixelRatio": 0.0008, "diffPixels": 900 },
        "requireMasks": true
      }
    }
  },
  "tagRules": {
    "criticalRoutes": ["/login", "/checkout", "/pricing"],
    "noisyRoutes": ["/dashboard", "/reports"]
  },
  "enforcement": {
    "allowLoosening": false,
    "maxMaskCoverageRatio": 0.35
  }
}
```

### Key Features

- **Automatic tag assignment**: Routes matching `tagRules` automatically get appropriate threshold tiers
- **Strict enforcement**: `allowLoosening: false` prevents per-screen overrides from weakening thresholds
- **Mask coverage limit**: `maxMaskCoverageRatio: 0.35` prevents over-masking (screens FAIL if >35% masked)
- **Justification required**: Loosening thresholds requires `overrideJustification` field in screen.json

### Validate Policy

```bash
pnpm gate policy validate
```

Shows resolved configuration, tag rules, enforcement settings, and warns about issues.

### Full Documentation

See [POLICY_GUIDE.md](./POLICY_GUIDE.md) for:
- Complete schema reference
- Resolution precedence rules
- Per-screen override examples
- Strict enforcement behavior
- Best practices and troubleshooting

---

### Approving Baselines with `approve-baseline`

When the gate detects intentional visual changes (e.g., UI redesign, new features), approve and commit updated baselines:

#### Method 1: GitHub PR Label (Recommended)

1. **Gate fails on PR** with visual differences
2. **Review the diff** in the uploaded artifact report
3. If changes are intentional, **add `approve-baseline` label** to the PR
4. **Baseline Approval workflow** automatically:
   - Re-captures baselines from the PR branch
   - Commits updated baselines to the PR
   - Removes the label
5. **Re-run PR gate** - should now pass with new baselines

#### Method 2: Manual Baseline Update

```bash
# Update all baselines
pnpm gate baseline update --baseURL http://localhost:5173

# Update only screens that failed in latest run
pnpm gate baseline update --baseURL http://localhost:5173 --changedOnly

# Update specific screens
pnpm gate baseline update --baseURL http://localhost:5173 --screens screen-03,screen-07
```

**Commit the updated baselines:**
```bash
git add baselines/
git commit -m "Update baselines for UI redesign"
git push
```

### Debug Mode

Enable detailed logging and diagnostic screenshots:

```bash
GATE_DEBUG=1 pnpm gate run --baseURL http://localhost:5173
```

**What it captures:**
- Console errors from the page
- Failed network requests
- Diagnostic screenshots before/after stabilization
- Layout shift measurements
- Timing information

Output is written to `runs/run-XXXXXX/per-screen/<screen-id>/debug.json`

### Common Error Messages

#### "No baselines/manifest.json found"

**Solution:** Create baselines first:
```bash
pnpm gate baseline add --from /path/to/screenshots
# or
pnpm generate:baselines
```

#### "Image dimensions mismatch"

**Cause:** Viewport changed between baseline and current run.

**Solution:** Either:
- Re-capture baselines with new viewport
- Ensure viewport is locked in `screen.json`

#### "Hash mismatch" during validation

**Cause:** Baseline PNG file was modified without updating manifest.

**Solution:**
```bash
# Re-import baselines to regenerate hashes
pnpm gate baseline add --from baselines/<screen-id>
```

#### "Masks required" for `noisy` tag

**Cause:** Screen is tagged `noisy` but has no masks defined.

**Solution:** Add at least one mask:
```bash
pnpm gate masks suggest --baseURL http://localhost:5173 --screen <screen-id> --apply
```

---

## Phase 1 Scope

**IN SCOPE (Phase 1):**
- ✅ CLI commands for baseline management and gate runs
- ✅ Playwright-based screenshot capture (Chromium only)
- ✅ Pixel-diff comparison with pixelmatch
- ✅ Configurable routes via baseline manifest
- ✅ Threshold overrides per route and per element
- ✅ Dynamic element masking (`data-gate-mask`, CSS selectors, rect masks)
- ✅ Evidence pack ZIP with SHA-256 hashes
- ✅ GitHub Actions workflows (PR gate, baseline approval, flake tracking)
- ✅ HTML and JSON reports
- ✅ Mask suggestion mode

**NOT IN SCOPE (Phase 1):**
- ❌ Flow YAML spec-to-test generation
- ❌ OpenAPI contract validation
- ❌ Multi-browser support (only Chromium)
- ❌ SaaS dashboard or hosted service
- ❌ Video recording or trace capture
- ❌ Accessibility testing
- ❌ Performance metrics
- ❌ Component-level testing (full page only)

---

## CLI Commands Reference

### Baseline Management

```bash
# Capture new baselines (requires running app)
pnpm gate baseline add
pnpm gate baseline add --route /specific-route

# Import baselines from PNG folder
pnpm gate baseline add --from /path/to/screenshots
pnpm gate baseline add --from /path/to/screenshots --meta screens.json

# List all baselines
pnpm gate baseline list

# Validate baseline integrity
pnpm gate baseline validate
pnpm gate baseline validate --check-hash

# Update existing baselines
pnpm gate baseline update --baseURL http://localhost:5173
pnpm gate baseline update --baseURL http://localhost:5173 --changedOnly
pnpm gate baseline update --baseURL http://localhost:5173 --screens screen-01,screen-03
```

### Gate Commands

```bash
# Run visual regression gate
pnpm gate run --baseURL http://localhost:5173

# Run in CI mode (exit 1 on any failure)
pnpm gate run --baseURL http://localhost:5173 --ci

# Test specific screens only
pnpm gate run --baseURL http://localhost:5173 --screens screen-01,screen-05

# Custom output directory
pnpm gate run --baseURL http://localhost:5173 --outDir ./custom-runs

# Generate evidence pack
pnpm gate pack
pnpm gate pack --runId run-1234567890
pnpm gate pack --out ./evidence-custom.zip
```

### Mask Commands

```bash
# Suggest masks for all screens
pnpm gate masks suggest --baseURL http://localhost:5173

# Suggest for specific screen
pnpm gate masks suggest --baseURL http://localhost:5173 --screen screen-05

# Auto-apply high-confidence suggestions
pnpm gate masks suggest --baseURL http://localhost:5173 --apply

# Reload page between snapshots for better detection
pnpm gate masks suggest --baseURL http://localhost:5173 --reload

# Limit suggestions per screen
pnpm gate masks suggest --baseURL http://localhost:5173 --maxSuggestions 5
```

### Help

All commands support `--help`:

```bash
pnpm gate --help
pnpm gate baseline --help
pnpm gate run --help
pnpm gate masks --help
```

---

## Why Determinism Matters

Visual regression testing is notoriously flaky. Small variations in timing, animations, fonts, network requests, or system time can cause pixel differences between screenshots taken seconds apart — even when nothing has actually changed in your code.

**AI Output Gate enforces deterministic rendering** to eliminate these sources of variation:

- **🎬 Animation Blocking**: All CSS animations and transitions are disabled via injected styles, ensuring static renders
- **⏰ Frozen Time**: JavaScript `Date.now()` and `performance.now()` are mocked to return fixed values, eliminating timestamp variations
- **🌐 Network Isolation**: External network requests are blocked; only localhost/127.0.0.1 traffic is allowed, preventing CDN or third-party flakes
- **📐 Layout Stability**: The tool waits for the page layout to settle (no bounding box changes >1px for 300ms) before capturing screenshots
- **🎨 Consistent Environment**: Fixed viewport (1280×720), device scale factor (1), locale (en-US), timezone (UTC), and color scheme (light)

This deterministic approach dramatically reduces false positives, achieving our target flake rate of ≤1% even with 200+ repeated runs of the same baseline.

---

## Architecture

```
├── packages/
│   ├── core/               # Screenshot + comparison engine
│   │   ├── src/
│   │   │   ├── screenshot.ts    # Playwright capture
│   │   │   ├── comparison.ts    # Pixelmatch diffing
│   │   │   ├── baseline.ts      # Baseline storage
│   │   │   ├── policy.ts        # Threshold enforcement
│   │   │   ├── evidence.ts      # Evidence pack creation
│   │   │   ├── report.ts        # HTML/JSON reports
│   │   │   ├── deterministic.ts # Deterministic rendering
│   │   │   └── mask-suggester.ts # Dynamic mask detection
│   │   └── package.json
│   └── cli/                # Command-line interface
│       ├── src/
│       │   ├── index.ts         # CLI entry point
│       │   ├── config.ts        # Config loader
│       │   └── commands/
│       │       ├── baseline.ts  # Baseline commands
│       │       ├── gate.ts      # Gate commands
│       │       ├── run.ts       # Run command
│       │       └── masks.ts     # Mask commands
│       └── package.json
├── examples/
│   └── demo-app/           # 20-route test harness
│       ├── ai-gate.config.json
│       └── src/
│           ├── App.tsx
│           └── pages/
├── baselines/              # Baseline screenshots (checked in)
│   ├── manifest.json
│   └── screen-*/
│       ├── baseline.png
│       └── screen.json
├── runs/                   # Test run outputs (gitignored)
│   └── latest/             # Symlink to most recent run
│       ├── per-screen/     # Per-screen results
│       ├── summary.json    # JSON results
│       ├── report.html     # HTML report
│       └── evidence.zip    # Evidence pack
└── .github/workflows/      # CI automation
    ├── ci.yml              # Lint/test/build
    ├── pr-gate.yml         # Visual regression on PRs
    ├── baseline-approval.yml # Baseline update automation
    └── nightly-flake.yml   # Flake rate tracker
```

**Frontend Routing:** Deep links are fully supported via Encore.ts's built-in SPA fallback mechanism. All routes (`/baselines`, `/docs/*`, etc.) work correctly on hard refresh without redirecting to `/`.

---

## GitHub Actions Integration

### PR Gate

Runs on every pull request, compares screenshots against baselines, uploads artifacts, posts PR comment.

**Workflow:** `.github/workflows/pr-gate.yml`

**Triggers:**
- On pull request open/sync
- On push to PR branch

**What it does:**
1. Checks out PR branch
2. Builds and starts demo app
3. Runs `pnpm gate run --baseURL http://localhost:5173 --ci`
4. Uploads `report.html` + evidence as artifacts
5. Posts PR comment with summary

### Baseline Approval

Add `approve-baseline` label to PR to auto-commit updated baselines.

**Workflow:** `.github/workflows/baseline-approval.yml`

**Triggers:**
- When `approve-baseline` label is added to PR

**What it does:**
1. Checks out PR branch
2. Builds and starts demo app
3. Runs `pnpm gate baseline update --baseURL http://localhost:5173`
4. Commits updated baselines back to PR branch
5. Removes `approve-baseline` label

**Required permissions:**
- `contents: write` - to commit baselines to PR branch
- `pull-requests: write` - to remove label

### Nightly Flake Tracker

Runs 250 iterations to measure flake rate. Updates `flake-metrics.json` and the flake rate badge.

**Workflow:** `.github/workflows/nightly-flake.yml`

**Triggers:**
- Scheduled cron: `0 2 * * *` (2 AM daily)
- Manual workflow dispatch

**What it does:**
1. Runs gate 250 times against unchanged baselines
2. Calculates flake rate (% of runs that failed)
3. Updates `flake-metrics.json`
4. Commits to `main` branch
5. Updates badge in README

**Required permissions:**
- `contents: write` - to commit flake-metrics.json back to main branch

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Flake Rate | ≤1% | 200+ repeated runs |
| Runtime | ≤5min | 20 screens in CI |
| False FAIL | ≤2% | 100+ no-change runs |
| Onboarding | ≤15min | Clone to first PR comment |

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Lint
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm typecheck

# Clean build artifacts
pnpm clean
```

---

## Harness Validation

To prove the gate correctly detects meaningful visual drift and avoids false confidence, run:

```bash
pnpm harness:regression-check
```

This automated validation:
1. ✅ Runs baseline gate check (should PASS)
2. ✅ Tests `button-padding` regression on screen-03 (should FAIL)
3. ✅ Tests `missing-banner` regression on screen-07 (should FAIL)
4. ✅ Tests `font-size` regression on screen-10 (should FAIL)

See [HARNESS_VALIDATION.md](./HARNESS_VALIDATION.md) for details.

**CI Integration**: The `regression-validation` job runs on `main` branch only to keep PR checks fast.

---

## License

MIT
