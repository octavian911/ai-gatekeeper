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

## Quick Start

### 1. Install Dependencies

```bash
npm ci
```

### 2. Build the Application

```bash
npm run build
```

### 3. Start the Application

```bash
npm start
```

The app will be available at `http://localhost:3000`

### 4. Run AI Gatekeeper

In a separate terminal:

```bash
npx ai-gate run --baseURL http://localhost:3000
```

### 5. View Results

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
7. Runs AI Gatekeeper
8. Uploads evidence artifacts (always, even on failure)

**No secrets or environment variables required.**

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

2. **Commit and push**:

```bash
git add app/login/page.tsx
git commit -m "Change login button text"
git push
```

3. **Observe CI Failure**:
   - GitHub Actions workflow will fail
   - Exit code will be non-zero
   - Evidence artifacts will show:
     - `baseline.png` - Original button with "Sign in"
     - `current.png` - New button with "Log In Now"
     - `diff.png` - Highlighted differences

4. **View Evidence**:
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

### Step 3: Build and Start

```bash
npm run build
npm start &
```

Wait for server to start (usually ~5 seconds).

### Step 4: Run Gate (Passing)

```bash
npx ai-gate run --baseURL http://localhost:3000
```

Expected output:
```
✓ All screens passed visual regression testing
Exit code: 0
```

### Step 5: Break UI and Re-run (Failing)

```bash
# Edit app/login/page.tsx line 71-75: Change "Sign in" to "Log In Now"
npx ai-gate run --baseURL http://localhost:3000
```

Expected output:
```
✗ Screen 'login' failed: Visual differences detected
Exit code: 1
Evidence: .ai-gate/evidence/login/diff.png
```

Inspect `.ai-gate/evidence/` to see baseline/current/diff images.

## Installing ai-gate CLI

This template assumes `ai-gate` is available via npm. For development:

### Option A: Use Published Package (Production)

```bash
npm install -D ai-gate
```

### Option B: Use Local Tarball (Development)

From the main repository root:

```bash
cd packages/cli
npm pack
# Produces: ai-gate-1.0.0.tgz
```

In this template:

```bash
npm install -D /path/to/ai-gate-1.0.0.tgz
```

### Option C: Use File Reference (Development)

```json
// package.json
{
  "devDependencies": {
    "ai-gate": "file:../../packages/cli"
  }
}
```

Then `npm install`.

## Troubleshooting

### Port Already in Use

If `localhost:3000` is occupied:

```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm start
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

## Next Steps

1. **Customize routes**: Add more pages in `app/`
2. **Add baselines**: Update `baselines/manifest.json` and generate new baseline images
3. **Adjust thresholds**: Modify `ai-gate.config.json` pixel diff tolerance
4. **Integrate with PR workflow**: Use GitHub Actions to block merges on visual regressions

## Support

For issues or questions about AI Gatekeeper, see the main repository documentation.
