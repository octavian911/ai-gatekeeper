# AI Gatekeeper - Customer Template Repository

This is a standalone Next.js application demonstrating how to integrate AI Gatekeeper for visual regression testing in a customer repository.

## Overview

This template includes:
- A Next.js app with two routes (`/login` and `/pricing`)
- Baseline screenshots for visual regression testing
- GitHub Actions workflow for automated CI testing
- Configuration for AI Gatekeeper

## Prerequisites

- Node.js 20+ and npm
- Chromium browser (auto-installed by Playwright)

## Installation

AI Gatekeeper can be installed in three ways:

### MODE A: Published Package (Recommended)

When `ai-gate` is published to npm:

```bash
npm install -D @ai-gate/cli
```

Then run:

```bash
npx ai-gate run --baseURL http://localhost:3000
```

### MODE B: GitHub Release (Pre-release/Testing)

Install directly from GitHub Releases:

```bash
# Install latest release
npm install -D https://github.com/YOUR-ORG/ai-gatekeeper/releases/latest/download/ai-gate-cli-1.0.0.tgz

# Or install specific version
npm install -D https://github.com/YOUR-ORG/ai-gatekeeper/releases/download/v1.0.0/ai-gate-cli-1.0.0.tgz
```

> **Note:** Check the [Releases page](https://github.com/YOUR-ORG/ai-gatekeeper/releases) for available versions and tarball names.

Then run:

```bash
npx ai-gate run --baseURL http://localhost:3000
```

### MODE C: Local TGZ (Development)

When testing local changes before release:

**Step 1:** Build and pack the CLI from the main repository root:

```bash
# From the ai-gatekeeper repository root
cd packages/cli
npm run build
npm pack
```

This creates a tarball: `ai-gate-cli-<version>.tgz`

**Step 2:** Install the tarball in this template:

```bash
# From examples/repo-b-template
npm install -D ../../packages/cli/ai-gate-cli-<version>.tgz
```

**Step 3:** Run AI Gatekeeper:

```bash
npx ai-gate run --baseURL http://localhost:3000
```

**Expected Output:**
```
AI Gatekeeper v1.0.0
Running visual regression tests...
✓ login passed
✓ pricing passed
All 2 screens passed
```

## Quick Start

### 1. Install Dependencies

```bash
npm ci
```

### 2. Build the Application

```bash
npm run build
```

### 3. Run Visual Regression Tests

Use the deterministic runner script:

```bash
npm run test:visual
```

This will:
1. Check if port 3000 is available (kill process if needed)
2. Start the Next.js server in background
3. Wait for `http://localhost:3000` to be ready
4. Run AI Gatekeeper
5. Stop the server automatically
6. Exit with appropriate code (0 = pass, 1 = fail)

**Manual Alternative:**

If you prefer to manage the server yourself:

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Run AI Gatekeeper
npx ai-gate run --baseURL http://localhost:3000
```

### 4. View Results

Evidence artifacts are generated at:
```
.ai-gate/evidence/
├── login/
│   ├── baseline.png
│   ├── current.png
│   └── diff.png
└── pricing/
    ├── baseline.png
    ├── current.png
    └── diff.png
```

## Directory Structure

```
.
├── app/
│   ├── layout.tsx          # Root layout
│   ├── login/
│   │   └── page.tsx        # Login page
│   └── pricing/
│       └── page.tsx        # Pricing page
├── baselines/
│   ├── manifest.json       # Screen configurations
│   ├── login/
│   │   └── baseline.png    # Login baseline image
│   └── pricing/
│       └── baseline.png    # Pricing baseline image
├── scripts/
│   └── run-visual-test.sh  # Deterministic test runner
├── .github/
│   └── workflows/
│       └── ai-gate.yml     # CI workflow
├── ai-gate.config.json     # AI Gatekeeper configuration
└── package.json
```

## Configuration

### ai-gate.config.json

```json
{
  "baselineDir": "./baselines",
  "outputDir": "./.ai-gate/evidence",
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "threshold": {
    "pixelDiffRatio": 0.001
  }
}
```

### baselines/manifest.json

Defines two screens:
- **login** - Authentication form at `/login`
- **pricing** - Pricing tiers at `/pricing`

Each screen specifies:
- `id`: Unique identifier
- `route`: URL path
- `viewport`: Screen dimensions (1280x720)
- `tags`: Categorization tags
- `description`: Human-readable description

## GitHub Actions Integration

The `.github/workflows/ai-gate.yml` workflow:

1. Checks out code
2. Sets up Node.js 20
3. Installs dependencies with `npm ci`
4. Installs Chromium browser
5. Builds the Next.js app
6. Starts the server in background
7. Waits for server to be ready (using `wait-on`)
8. Runs AI Gatekeeper
9. Uploads evidence artifacts (always, even on failure)

**No secrets or environment variables required.**

The workflow uses `wait-on` to ensure the server is fully started before running tests, preventing race conditions.

## Testing CI Failures

### Intentional Failure Demo

To demonstrate AI Gatekeeper catching visual regressions:

1. **Break the UI**: Edit `app/login/page.tsx` line 71-75 and change the button text:

```tsx
// BEFORE:
Sign in

// AFTER:
Log In Now
```

2. **Run tests locally**:

```bash
npm run test:visual
```

Expected output:
```
✗ login failed: Visual differences detected
Exit code: 1
Evidence: .ai-gate/evidence/login/diff.png
```

3. **Commit and push**:

```bash
git add app/login/page.tsx
git commit -m "Change login button text"
git push
```

4. **Observe CI Failure**:
   - GitHub Actions workflow will fail
   - Exit code will be non-zero
   - Evidence artifacts will show:
     - `baseline.png` - Original button with "Sign in"
     - `current.png` - New button with "Log In Now"
     - `diff.png` - Highlighted differences

5. **View Evidence**:
   - Go to Actions tab in GitHub
   - Click on the failed workflow run
   - Download the `ai-gate-evidence` artifact
   - Inspect the diff images

### Other Breaking Changes to Test

**Login Page (`app/login/page.tsx`)**:
- Line 35: Change `padding: '48px'` to `padding: '24px'` (smaller card)
- Line 44: Change `fontSize: '28px'` to `fontSize: '32px'` (larger heading)
- Line 125: Change button `background: '#667eea'` to `background: '#ff0000'` (red button)

**Pricing Page (`app/pricing/page.tsx`)**:
- Line 24: Change `fontSize: '48px'` to `fontSize: '36px'` (smaller heading)
- Line 87: Change `$29` to `$39` (price change)
- Line 161: Change `$79` to `$99` (price change)

Each change will trigger a CI failure with visual evidence.

## 5-Step Dogfood Procedure (Fresh Clone)

Starting from a clean environment:

### Step 1: Clone and Navigate

```bash
git clone <repo-url>
cd <repo-name>/examples/repo-b-template
```

### Step 2: Install Dependencies

```bash
npm ci
npx playwright install chromium --with-deps
```

### Step 3: Install AI Gatekeeper

Choose MODE A, MODE B, or MODE C from the Installation section above.

For MODE B (GitHub Release):
```bash
npm install -D https://github.com/YOUR-ORG/ai-gatekeeper/releases/latest/download/ai-gate-cli-1.0.0.tgz
```

For MODE C (local TGZ):
```bash
# From main repo root
cd packages/cli
npm run build
npm pack
cd ../../examples/repo-b-template
npm install -D ../../packages/cli/ai-gate-cli-*.tgz
```

### Step 4: Build App

```bash
npm run build
```

### Step 5: Run Visual Tests (Passing)

```bash
npm run test:visual
```

Expected output:
```
Checking if port 3000 is available...
Starting Next.js server...
Waiting for http://localhost:3000...
Running AI Gatekeeper...
✓ login passed
✓ pricing passed
All 2 screens passed
Stopping server...
```

Exit code: `0`

### Step 6: Break UI and Re-run (Failing)

Use the provided scripts:

```bash
# Break the UI
./scripts/break-ui.sh

# Run tests again
npm run test:visual
```

Expected output:
```
...
✗ login failed: Visual differences detected
Evidence: .ai-gate/evidence/login/diff.png
Exit code: 1
```

Inspect `.ai-gate/evidence/` to see baseline/current/diff images.

```bash
# Restore the UI
./scripts/restore-ui.sh
```

## Troubleshooting

### Port Already in Use

The `test:visual` script automatically handles this by killing existing processes on port 3000.

If you need to manually free the port:

```bash
lsof -ti:3000 | xargs kill -9
```

Or use a different port:

```bash
PORT=3001 npm start &
npx wait-on http://localhost:3001 --timeout 60000
npx ai-gate run --baseURL http://localhost:3001
```

### Chromium Not Found

```bash
npx playwright install chromium --with-deps
```

### Build Failures

Ensure Node.js 20+ is installed:

```bash
node --version  # Should be v20.x or higher
```

### Server Timeout

If `wait-on` times out, increase the timeout in the script:

```bash
npx wait-on http://localhost:3000 --timeout 120000  # 2 minutes
```

## Next Steps

1. **Customize routes**: Add more pages in `app/`
2. **Add baselines**: Update `baselines/manifest.json` and generate new baseline images
3. **Adjust thresholds**: Modify `ai-gate.config.json` pixel diff tolerance
4. **Integrate with PR workflow**: Use GitHub Actions to block merges on visual regressions

## Support

For issues or questions about AI Gatekeeper, see the main repository documentation.
