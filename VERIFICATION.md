# Verification Checklist

This document verifies that the monorepo scaffold meets all Phase 1 requirements.

## ✅ Repository Structure

- [x] pnpm workspaces configured (`pnpm-workspace.yaml`)
- [x] TypeScript project references (`tsconfig.json`, `tsconfig.base.json`)
- [x] Folder structure:
  - `packages/core` - Screenshot comparison engine
  - `packages/cli` - Command-line interface
  - `examples/demo-app` - 20-route test harness
  - `baselines/` - Baseline storage (checked in)
  - `runs/` - Test runs (gitignored)
  - `.github/workflows/` - CI automation

## ✅ Developer Experience

- [x] ESLint configured (`.eslintrc.json`)
- [x] Prettier configured (`.prettierrc.json`)
- [x] TypeScript strict mode enabled
- [x] Vitest configured for unit tests
- [x] Playwright installed (Chromium only)
- [x] Root-level scripts:
  - `pnpm install` - Install dependencies
  - `pnpm build` - Build all packages
  - `pnpm lint` - Lint codebase
  - `pnpm lint:fix` - Auto-fix linting issues
  - `pnpm format` - Format code
  - `pnpm format:check` - Check formatting
  - `pnpm typecheck` - Type check all packages
  - `pnpm test` - Run all tests
  - `pnpm test:watch` - Watch mode
  - `pnpm clean` - Clean build artifacts

## ✅ CLI Commands

- [x] `pnpm gate --help` prints usage
- [x] Baseline commands:
  - `pnpm gate baseline add` - Capture baselines
  - `pnpm gate baseline list` - List baselines
  - `pnpm gate baseline validate` - Validate baselines
  - `pnpm gate baseline update` - Update baselines
- [x] Gate commands:
  - `pnpm gate run` - Run visual regression
  - `pnpm gate run --threshold X` - Custom threshold
  - `pnpm gate run --route X` - Test specific route
  - `pnpm gate pack` - Generate evidence pack
- [x] Mask commands:
  - `pnpm gate masks suggest` - Suggest masks

## ✅ GitHub Actions Workflows

- [x] `.github/workflows/ci.yml` - Lint, test, build on push/PR
- [x] `.github/workflows/pr-gate.yml` - Visual regression on PRs
- [x] `.github/workflows/baseline-approval.yml` - Auto-update baselines
- [x] `.github/workflows/nightly-flake.yml` - Flake rate tracking

## ✅ Documentation

- [x] `README.md` with:
  - What the tool does
  - Phase 1 scope (IN/NOT IN)
  - Quick start guide
  - 90% ready metrics section
  - Configuration examples
  - Architecture diagram
- [x] `CONTRIBUTING.md` - Developer guidelines
- [x] `CHANGELOG.md` - Version history

## ✅ Demo App

- [x] 20 routes defined (pages/ folder)
- [x] Vite + React + TypeScript setup
- [x] Tailwind CSS configured
- [x] `ai-gate.config.json` with route definitions
- [x] Dev server runs on port 5173

## ✅ Package Configuration

### packages/core
- [x] TypeScript configured
- [x] Vitest configured
- [x] Playwright dependency
- [x] pixelmatch + pngjs dependencies
- [x] Build script (`tsc --build`)
- [x] Test script (`vitest run`)
- [x] Placeholder tests pass

### packages/cli
- [x] TypeScript configured
- [x] References `@ai-gate/core`
- [x] Commander.js for CLI
- [x] Chalk + Ora for output
- [x] Binary entry point (`ai-gate`)
- [x] Build script (`tsc --build`)
- [x] Placeholder tests pass

## 🧪 Verification Steps

Run these commands to verify the scaffold:

```bash
# 1. Install works
pnpm install

# 2. Lint works (may have warnings, no errors)
pnpm lint

# 3. Format check works
pnpm format:check

# 4. Type check works
pnpm typecheck

# 5. Build works
pnpm build

# 6. Tests pass
pnpm test

# 7. CLI help works
pnpm gate --help
pnpm gate baseline --help
pnpm gate run --help
pnpm gate masks --help

# 8. Demo app starts (in separate terminal)
cd examples/demo-app
pnpm dev
# Should run on http://localhost:5173
```

## 📊 90% Ready Metrics (To Be Measured)

These metrics will be validated once gate logic is implemented:

| Metric | Target | Status |
|--------|--------|--------|
| Flake Rate | ≤1% | 🔄 To be measured |
| Runtime | ≤5min (20 screens) | 🔄 To be measured |
| False FAIL | ≤2% | 🔄 To be measured |
| Onboarding | ≤15min | 🔄 To be measured |

## 🚀 Next Steps

The scaffold is complete. Next phases:
1. Implement core screenshot logic (`packages/core`)
2. Wire up CLI commands to core engine
3. Test against demo app
4. Measure 90% ready metrics
5. Refine thresholds and flake handling
