# Quick Start Guide

Get up and running in 5 minutes.

## Prerequisites

- Node.js 18+
- pnpm 8+

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Build Packages

```bash
pnpm build
```

## 3. Verify Setup

```bash
# Run full verification
pnpm verify

# Or manually check:
pnpm lint
pnpm typecheck
pnpm test
```

## 4. Test CLI

```bash
# View help
pnpm gate --help

# View baseline commands
pnpm gate baseline --help

# View gate commands
pnpm gate run --help
```

## 5. Start Demo App

```bash
cd examples/demo-app
pnpm install
pnpm dev
```

Visit http://localhost:5173 to see the 20-route demo app.

## 6. Next Steps

The scaffold is complete! To implement the gate logic:

1. **Implement Core Engine** (`packages/core/src/`)
   - `screenshot.ts` - Playwright capture
   - `comparison.ts` - Pixelmatch diffing
   - `baseline.ts` - Baseline storage
   - `report.ts` - Report generation
   - `evidence.ts` - Evidence packs

2. **Test Against Demo App**
   ```bash
   pnpm gate baseline add    # Capture baselines
   pnpm gate run             # Run gate
   open runs/latest/report.html
   ```

3. **Measure Metrics**
   - Flake rate (200+ runs)
   - Runtime (≤5min for 20 screens)
   - False FAIL rate (≤2%)
   - Onboarding time (≤15min)

## Common Commands

```bash
# Development
pnpm build              # Build all packages
pnpm test               # Run tests
pnpm test:watch         # Watch mode
pnpm lint               # Lint code
pnpm lint:fix           # Fix linting issues
pnpm format             # Format code
pnpm typecheck          # Type check

# CLI
pnpm gate --help        # View help
pnpm gate baseline add  # Capture baselines
pnpm gate run           # Run gate
pnpm gate pack          # Create evidence pack

# Clean
pnpm clean              # Remove build artifacts
```

## Troubleshooting

### pnpm not found
```bash
npm install -g pnpm
```

### TypeScript errors
```bash
pnpm clean
pnpm install
pnpm build
```

### Playwright browser not found
```bash
pnpm exec playwright install chromium --with-deps
```

## Project Structure

```
packages/core       # Screenshot comparison engine
packages/cli        # Command-line interface
examples/demo-app   # 20-route test harness
baselines/          # Baseline screenshots (checked in)
runs/               # Test runs (gitignored)
.github/workflows/  # CI automation
```

## Documentation

- **README.md** - Full documentation
- **VERIFICATION.md** - Setup verification
- **CONTRIBUTING.md** - Contributor guide
- **SCAFFOLD_COMPLETE.md** - What's implemented

## Support

For issues or questions, see CONTRIBUTING.md for guidelines.
