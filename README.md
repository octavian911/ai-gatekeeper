# AI Output Gate

**Visual regression + fidelity gate to prevent UI drift from AI-generated code**

Phase 1: CLI-based visual regression testing with GitHub Actions integration.

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Start demo app (in one terminal)
cd examples/demo-app
pnpm dev

# Run baseline capture (in another terminal)
cd packages/cli
pnpm cli baseline add
```

### Running the Gate

```bash
# Run visual regression gate
pnpm cli gate run

# Generate evidence pack
pnpm cli gate pack

# View results
open ../../runs/latest/report.html
```

## Architecture

```
├── packages/
│   ├── core/          # Visual regression engine
│   └── cli/           # Command-line interface
├── examples/
│   └── demo-app/      # 20-route demo harness
├── baselines/         # Baseline screenshots (checked in)
├── runs/             # Test runs (gitignored)
└── .github/workflows/ # CI automation
```

## CLI Commands

### Baseline Management

```bash
# Add new baseline screenshots
pnpm cli baseline add

# List all baselines
pnpm cli baseline list

# Validate baselines exist
pnpm cli baseline validate

# Update specific baselines
pnpm cli baseline update --route /dashboard
```

### Visual Gate

```bash
# Run visual regression gate
pnpm cli gate run

# Run with custom threshold
pnpm cli gate run --threshold 0.001

# Run specific routes
pnpm cli gate run --route /login --route /dashboard
```

### Evidence & Reporting

```bash
# Generate evidence pack (zip with hashes)
pnpm cli gate pack

# Suggest masking for dynamic elements
pnpm cli masks suggest
```

## Deterministic Rendering

The gate enforces deterministic rendering:

- ✅ Animations disabled via CSS injection
- ✅ Fixed viewport (1280x720)
- ✅ External network blocked
- ✅ Stable waits (networkidle + custom selectors)
- ✅ Fixed date/time mocking
- ✅ Consistent fonts loaded

## Thresholds & Masking

### Global Defaults

```typescript
{
  pixelDiffThreshold: 0.001,  // 0.1% pixel difference allowed
  antiAliasingTolerance: 5,    // Fuzzy matching for AA
  maxDiffPixels: 100           // Absolute max changed pixels
}
```

### Tag Overrides

Routes can specify custom thresholds via `data-gate-threshold` attributes:

```html
<!-- Allow more drift for charts -->
<div data-gate-tag="chart" data-gate-threshold="0.005">
  <canvas>...</canvas>
</div>
```

### Masking Dynamic Content

```html
<!-- Mask timestamps, random IDs, etc -->
<span data-gate-mask="always">12:34:56 PM</span>
<div data-gate-mask="user-avatar">...</div>
```

Mask suggestion mode analyzes diffs and recommends masks.

## GitHub Actions Workflows

### PR Gate (`.github/workflows/pr-gate.yml`)

Runs on every pull request:
1. Captures screenshots of all routes
2. Compares against baselines
3. Uploads artifacts (diffs, report, evidence)
4. Posts summary comment on PR
5. Updates status badge

### Baseline Approval (`.github/workflows/baseline-approval.yml`)

Triggered by `approve-baseline` label:
1. Updates baselines with current screenshots
2. Commits to PR branch
3. Removes label

### Nightly Flake Tracker (`.github/workflows/nightly-flake.yml`)

Runs harness 200+ times:
1. Computes flake rate per route
2. Writes `flake-metrics.json`
3. Updates flake badge
4. Alerts if flake rate > 1%

## Demo Harness

The `examples/demo-app` contains 20 routes testing:

- Static content
- Forms & inputs
- Charts & visualizations
- Tables with data
- Modals & overlays
- Dynamic lists
- Image galleries
- Responsive layouts
- Dark/light themes
- Loading states

**Regression Toggles**: Each route has a `?regression=true` param to inject intentional changes for testing.

## Performance Targets

- ✅ Flake rate ≤ 1% (200+ runs)
- ✅ Runtime ≤ 5 min for 20 screens (GitHub Actions)
- ✅ False FAIL ≤ 2% on no-change runs
- ✅ Onboarding ≤ 15 min (clone → baseline → PR comment)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Start demo app
cd examples/demo-app && pnpm dev
```

## Phase 2+ (Not Implemented)

- Flow YAML spec-to-test generation
- OpenAPI contract guardrails
- Hosted SaaS dashboard

## License

MIT
