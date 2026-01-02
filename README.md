# AI Output Gate

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
pnpm gate baseline add           # Capture new baselines
pnpm gate baseline list          # List all baselines
pnpm gate baseline validate      # Verify baseline integrity
pnpm gate baseline update        # Update existing baselines

# Gate commands
pnpm gate run                    # Run visual regression gate
pnpm gate run --threshold 0.005  # Custom threshold
pnpm gate run --route /dashboard # Test specific route
pnpm gate pack                   # Generate evidence ZIP

# Mask commands
pnpm gate masks suggest          # Suggest masks for dynamic elements
```

### Demo App Setup

```bash
# Start demo app (20 routes)
cd examples/demo-app
pnpm install
pnpm dev  # Runs on http://localhost:5173

# In another terminal: capture baselines
pnpm gate baseline add

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
