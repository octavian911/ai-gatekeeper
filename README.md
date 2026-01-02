# AI Output Gate

[![PR Gate](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/pr-gate.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/pr-gate.yml)

**Visual regression gate preventing UI drift in AI-generated code.**

Deterministic screenshot comparison for CI/CD with Playwright + pixel-diff engine. Phase 1 is CLI-based; zero SaaS dependencies.

## What This Tool Does

AI Output Gate captures pixel-perfect baseline screenshots of your frontend routes and validates them in CI to catch unintended visual changes from AI-generated code modifications. It enforces deterministic rendering (disabled animations, fixed viewport, network blocking, stable waits) to minimize flakes.

**Core capabilities:**
- 📸 Baseline screenshot capture and storage
- 🔍 Pixel-diff comparison with configurable thresholds
- 🎭 Dynamic element masking for timestamps/IDs
- 📦 Evidence pack generation (zipped, hashed screenshots)
- 🤖 GitHub Actions integration with PR comments
- 📊 HTML/JSON reporting

## Phase 1 Scope

**IN SCOPE (Phase 1):**
- ✅ CLI commands for baseline management and gate runs
- ✅ Playwright-based screenshot capture (Chromium only)
- ✅ Pixel-diff comparison with pixelmatch
- ✅ Configurable routes via `ai-gate.config.json`
- ✅ Threshold overrides per route and per element
- ✅ Dynamic element masking (`data-gate-mask`)
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

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+

### Installation

```bash
# Clone repo
git clone <your-repo-url>
cd ai-output-gate

# Install dependencies
pnpm install

# Build packages
pnpm build
```

### Running the CLI

```bash
# View help
pnpm gate --help

# Baseline commands
pnpm gate baseline add                              # Capture new baselines
pnpm gate baseline add --from <folder>              # Import from PNG folder
pnpm gate baseline add --from <folder> --meta screens.json  # Import with metadata
pnpm gate baseline list                             # List all baselines
pnpm gate baseline validate                         # Verify baseline integrity
pnpm gate baseline validate --check-hash            # Verify hashes match manifest
pnpm gate baseline update                           # Update existing baselines

# Gate commands
pnpm gate run                    # Run visual regression gate
pnpm gate run --threshold 0.005  # Custom threshold
pnpm gate run --route /dashboard # Test specific route
pnpm gate pack                   # Generate evidence ZIP

# Mask commands
pnpm gate masks suggest          # Suggest masks for dynamic elements
```

### Demo App Setup

The demo app includes 20 routes with consistent UI, dynamic elements (clock, quote), and intentional regression scenarios.

```bash
# From repository root

# 1. Install dependencies and build
pnpm install
pnpm build

# 2. Create placeholder baseline files (if not already present)
pnpm setup:baselines

# 3. Generate real baselines (starts app, captures screenshots, stops app)
pnpm generate:baselines

# 4. Run the harness (starts app, runs gate, stops app)
pnpm harness:run-once

# Or manually:
# Start demo app
pnpm demo:start  # Runs on http://localhost:5173

# In another terminal: run gate
pnpm gate run --baseURL http://localhost:5173

# Test regression scenarios
VITE_REGRESSION_CASE=button-padding pnpm demo:start  # Screen 03: increased button padding
VITE_REGRESSION_CASE=missing-banner pnpm demo:start  # Screen 07: hidden banner
VITE_REGRESSION_CASE=font-size pnpm demo:start       # Screen 10: changed heading size

# Or import from existing PNG folder
pnpm gate baseline add --from /path/to/screenshots

# Validate baselines
pnpm gate baseline validate

# Run gate
pnpm gate run

# View report
open ../../runs/latest/report.html
```

## 90% Ready Metrics

**Flake Rate (Target: ≤1%)**
- Measured via 200+ repeated runs of same baseline
- Nightly CI job tracks flake rate per route
- Deterministic rendering enforced (animations off, fixed viewport, network blocked)

**Runtime (Target: ≤5min for 20 screens)**
- CI runtime measured in GitHub Actions
- Parallelization disabled (sequential runs for stability)
- Playwright Chromium only

**Onboarding (Target: ≤15min clone→baseline→PR)**
- Timed from `git clone` to first PR comment with gate results
- Includes: install deps, build packages, start demo app, capture baselines, run gate, view report

**False FAIL Rate (Target: ≤2%)**
- No-change runs should pass >98% of the time
- Measured by running gate against unchanged baselines 100+ times

## Why Determinism Matters

Visual regression testing is notoriously flaky. Small variations in timing, animations, fonts, network requests, or system time can cause pixel differences between screenshots taken seconds apart — even when nothing has actually changed in your code.

**AI Output Gate enforces deterministic rendering** to eliminate these sources of variation:

- **🎬 Animation Blocking**: All CSS animations and transitions are disabled via injected styles, ensuring static renders
- **⏰ Frozen Time**: JavaScript `Date.now()` and `performance.now()` are mocked to return fixed values, eliminating timestamp variations
- **🌐 Network Isolation**: External network requests are blocked; only localhost/127.0.0.1 traffic is allowed, preventing CDN or third-party flakes
- **📐 Layout Stability**: The tool waits for the page layout to settle (no bounding box changes >1px for 300ms) before capturing screenshots
- **🎨 Consistent Environment**: Fixed viewport (1280×720), device scale factor (1), locale (en-US), timezone (UTC), and color scheme (light)

This deterministic approach dramatically reduces false positives, achieving our target flake rate of ≤1% even with 200+ repeated runs of the same baseline.

**Debug Mode**: Set `GATE_DEBUG=1` to capture console errors, network failures, and diagnostic screenshots to troubleshoot any remaining variation.

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
│       │       └── masks.ts     # Mask commands
│       └── package.json
├── examples/
│   └── demo-app/           # 20-route test harness
│       ├── ai-gate.config.json
│       └── src/
│           ├── App.tsx
│           └── pages/
├── baselines/              # Baseline screenshots (checked in)
├── runs/                   # Test run outputs (gitignored)
│   └── latest/             # Symlink to most recent run
│       ├── actual/         # Current screenshots
│       ├── diff/           # Diff images
│       ├── summary.json    # JSON results
│       ├── report.html     # HTML report
│       └── evidence.zip    # Evidence pack
└── .github/workflows/      # CI automation
    ├── ci.yml              # Lint/test/build
    ├── pr-gate.yml         # Visual regression on PRs
    ├── baseline-approval.yml # Baseline update automation
    └── nightly-flake.yml   # Flake rate tracker
```

## Configuration

Create `ai-gate.config.json` in your project root:

```json
{
  "baseUrl": "http://localhost:5173",
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "policy": {
    "pixelDiffThreshold": 0.001,
    "antiAliasingTolerance": 5,
    "maxDiffPixels": 100
  },
  "routes": [
    {
      "name": "home",
      "path": "/",
      "waitForSelector": "[data-testid='content']"
    },
    {
      "name": "dashboard",
      "path": "/dashboard",
      "threshold": 0.005
    }
  ]
}
```

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
```

## GitHub Actions Integration

### PR Gate
Runs on every pull request, compares screenshots against baselines, uploads artifacts, posts PR comment.

### Baseline Approval
Add `approve-baseline` label to PR to auto-commit updated baselines.

### Nightly Flake Tracker
Runs 200+ iterations to measure flake rate and alert if >1%.

See `.github/workflows/` for workflow definitions.

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Flake Rate | ≤1% | 200+ repeated runs |
| Runtime | ≤5min | 20 screens in CI |
| False FAIL | ≤2% | 100+ no-change runs |
| Onboarding | ≤15min | Clone to first PR comment |

## License

MIT
