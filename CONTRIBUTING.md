# Contributing to AI Output Gate

## Development Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start demo app for testing
cd examples/demo-app
pnpm dev
```

## Running Tests

```bash
# Unit tests
pnpm test

# Visual regression gate (local)
cd packages/cli
pnpm cli baseline add
pnpm cli gate run
```

## Testing Regression Detection

The demo app supports a `?regression=true` query parameter to inject intentional UI changes:

```bash
# Test regression detection
cd packages/cli

# Capture baselines without regressions
pnpm cli baseline add

# Visit routes with ?regression=true
# Then run gate (should fail)
pnpm cli gate run
```

## Architecture

### Core Package (@ai-gate/core)

Contains the visual regression engine:

- `screenshot.ts` - Playwright-based deterministic screenshot capture
- `comparison.ts` - Pixelmatch-based image diffing
- `baseline.ts` - Baseline management with hashing
- `policy.ts` - Threshold evaluation logic
- `report.ts` - HTML/JSON report generation
- `evidence.ts` - Evidence pack creation

### CLI Package (@ai-gate/cli)

Command-line interface:

- `baseline` - Manage baseline screenshots
- `gate` - Run visual regression tests
- `masks` - Suggest masking strategies

### Demo App (examples/demo-app)

React application with 20 routes for testing:

- Routes support `?regression=true` for intentional changes
- Uses `data-gate-tag` for threshold overrides
- Uses `data-gate-mask` for masking dynamic content

## GitHub Actions Workflows

### PR Gate (`.github/workflows/pr-gate.yml`)

Runs on every pull request:
1. Captures screenshots
2. Compares against baselines
3. Uploads artifacts
4. Posts PR comment with results

### Baseline Approval (`.github/workflows/baseline-approval.yml`)

Triggered by `approve-baseline` label:
1. Updates baselines
2. Commits to PR branch
3. Removes label

### Nightly Flake (`.github/workflows/nightly-flake.yml`)

Runs daily at 2 AM UTC:
1. Executes 200 test runs
2. Computes flake rate
3. Updates metrics and badge
4. Fails if flake rate > 1%

## Release Process

1. Update version in package.json files
2. Run `pnpm build`
3. Run `pnpm test`
4. Run local gate verification
5. Create git tag
6. Push to GitHub
