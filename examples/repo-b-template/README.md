# AI Gatekeeper - Next.js Template

**A ready-to-use Next.js template with AI Gatekeeper visual regression testing pre-configured.**

[![Use this template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge)](https://github.com/AI-Gatekeeper/ai-gate-template-nextjs/generate)

This template demonstrates how to integrate AI Gatekeeper into your Next.js project for automated visual regression testing in CI/CD.

## What's Included

- ✅ Next.js app with sample pages (`/login` and `/pricing`)
- ✅ Baseline screenshots for visual testing
- ✅ GitHub Actions workflow configured
- ✅ AI Gatekeeper configuration
- ✅ Scripts to test and demonstrate failures

## Quick Start

### 1️⃣ Use This Template

Click **"Use this template"** above or visit:
```
https://github.com/AI-Gatekeeper/ai-gate-template-nextjs/generate
```

Clone your new repository:
```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
cd YOUR-REPO-NAME
```

### 2️⃣ Install Dependencies

```bash
npm ci
npx playwright install chromium --with-deps
```

### 3️⃣ Build the Application

```bash
npm run build
```

### 4️⃣ Run Visual Tests Locally

```bash
npm run test:visual
```

**Expected output:**
```
✓ login passed
✓ pricing passed
All 2 screens passed
```

This script:
- Starts the Next.js server on port 3000
- Waits for the server to be ready
- Runs AI Gatekeeper visual tests
- Stops the server automatically
- Exits with code 0 (pass) or 1 (fail)

## Test a Failure

To see AI Gatekeeper catch a visual regression:

### Option 1: Use the Break Script

```bash
./scripts/break-ui.sh
npm run test:visual
```

**Expected output:**
```
✗ login failed: Visual differences detected
Evidence: .ai-gate/evidence/login/diff.png
```

Inspect `.ai-gate/evidence/login/` to see:
- `baseline.png` - Original screenshot
- `current.png` - New screenshot with changes
- `diff.png` - Highlighted differences

Restore the UI:
```bash
./scripts/restore-ui.sh
```

### Option 2: Manual Change

Edit `app/login/page.tsx` and change the button text on line 71-75:

```tsx
// BEFORE:
Sign in

// AFTER:
Log In Now
```

Then run:
```bash
npm run test:visual
```

AI Gatekeeper will detect the text change and fail the test.

## GitHub Actions Integration

This template includes `.github/workflows/ai-gate.yml` which:

1. ✅ Runs on every pull request
2. ✅ Builds the Next.js app
3. ✅ Starts the server and runs visual tests
4. ✅ Uploads evidence artifacts (always, even on failure)

**No secrets or API keys required.**

### How to View Evidence in GitHub

When a test fails in CI:

1. Go to the **Actions** tab in your repository
2. Click on the failed workflow run
3. Scroll to **Artifacts** section
4. Download `ai-gate-evidence`
5. Extract and inspect the diff images

The artifact contains:
```
ai-gate-evidence/
├── login/
│   ├── baseline.png
│   ├── current.png
│   └── diff.png
└── pricing/
    ├── baseline.png
    ├── current.png
    └── diff.png
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

- **baselineDir**: Where baseline images are stored
- **outputDir**: Where evidence artifacts are saved
- **viewport**: Browser dimensions for screenshots
- **threshold**: Pixel difference tolerance (0.001 = 0.1%)

### baselines/manifest.json

Defines the screens to test:

```json
{
  "baselines": [
    {
      "screenId": "login",
      "name": "Login Page",
      "url": "/login",
      "viewport": { "width": 1280, "height": 720 },
      "tags": ["auth", "critical"],
      "description": "User authentication form"
    },
    {
      "screenId": "pricing",
      "name": "Pricing Page", 
      "url": "/pricing",
      "viewport": { "width": 1280, "height": 720 },
      "tags": ["marketing"],
      "description": "Product pricing tiers"
    }
  ]
}
```

## Directory Structure

```
.
├── .github/
│   └── workflows/
│       └── ai-gate.yml           # CI workflow
├── app/
│   ├── layout.tsx                # Root layout
│   ├── login/
│   │   └── page.tsx              # Login page
│   └── pricing/
│       └── page.tsx              # Pricing page
├── baselines/
│   ├── manifest.json             # Screen definitions
│   ├── login/
│   │   └── baseline.png          # Login baseline
│   └── pricing/
│       └── baseline.png          # Pricing baseline
├── scripts/
│   ├── break-ui.sh               # Intentionally break UI
│   ├── restore-ui.sh             # Restore original UI
│   └── run-visual-test.sh        # Deterministic test runner
├── ai-gate.config.json           # AI Gatekeeper config
├── package.json
├── next.config.js
└── tsconfig.json
```

## Customizing for Your Project

### Add More Pages

1. Create new pages in `app/`
2. Add entries to `baselines/manifest.json`
3. Generate baseline screenshots:
   ```bash
   npm run build
   npm start &
   npx ai-gate baseline --baseURL http://localhost:3000
   ```
4. Commit the new baseline images

### Adjust Thresholds

If you're getting false positives (tests failing when nothing visually changed):

Edit `ai-gate.config.json`:
```json
{
  "threshold": {
    "pixelDiffRatio": 0.005  // Increase tolerance (0.5%)
  }
}
```

### Change Viewport

Edit `ai-gate.config.json` to test different screen sizes:
```json
{
  "viewport": {
    "width": 1920,
    "height": 1080
  }
}
```

## Troubleshooting

### Port 3000 Already in Use

The test script automatically kills processes on port 3000. To manually free it:

```bash
lsof -ti:3000 | xargs kill -9
```

Or use a different port:

```bash
PORT=3001 npm start &
npx ai-gate run --baseURL http://localhost:3001
```

### Chromium Not Found

```bash
npx playwright install chromium --with-deps
```

### Server Timeout

If the server takes longer to start, increase the timeout in `scripts/run-visual-test.sh`:

```bash
npx wait-on http://localhost:3000 --timeout 120000  # 2 minutes
```

### Tests Pass Locally But Fail in CI

Check for dynamic content:
- Timestamps
- Random data
- Animation frames
- External API responses

Use masks to ignore dynamic regions (see AI Gatekeeper documentation).

## Learn More

- [AI Gatekeeper Documentation](https://github.com/AI-Gatekeeper/ai-gatekeeper)
- [Next.js Documentation](https://nextjs.org/docs)
- [Playwright Documentation](https://playwright.dev)

## Support

For issues with:
- **This template**: [Open an issue](https://github.com/AI-Gatekeeper/ai-gate-template-nextjs/issues)
- **AI Gatekeeper**: [Main repo issues](https://github.com/AI-Gatekeeper/ai-gatekeeper/issues)

## License

MIT License - See LICENSE file for details
