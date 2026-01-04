# @ai-gate/cli

AI Gatekeeper CLI - Visual regression testing that blocks PRs on visual drift.

## Installation

```bash
npm install -D @ai-gate/cli
```

## Quick Start

```bash
# Start your app
npm run dev

# Run the gate
npx ai-gate run --baseURL http://localhost:3000
```

## Commands

### `ai-gate run`

Run visual regression tests against baselines.

```bash
npx ai-gate run --baseURL <url> [options]
```

**Options:**
- `--baseURL <url>` - (Required) Base URL of running application
- `--screens <ids>` - Test specific screens (comma-separated)
- `--outDir <dir>` - Custom output directory (default: `.ai-gate/evidence/run-TIMESTAMP`)

**Exit codes:**
- `0` - All tests passed or warned
- `1` - One or more tests failed

**Examples:**

```bash
# Run all screens
npx ai-gate run --baseURL http://localhost:3000

# Test specific screens
npx ai-gate run --baseURL http://localhost:3000 --screens screen-01,screen-03

# Custom output directory
npx ai-gate run --baseURL http://localhost:3000 --outDir ./evidence
```

### `ai-gate baseline`

Manage baseline screenshots.

```bash
# List all baselines
npx ai-gate baseline list

# Add baselines from directory
npx ai-gate baseline add --from ./screenshots

# Validate baselines
npx ai-gate baseline validate
```

### `ai-gate policy`

View and validate organization policy.

```bash
npx ai-gate policy show
npx ai-gate policy validate
```

### `ai-gate masks`

Manage dynamic region masks.

```bash
npx ai-gate masks suggest --from ./screenshots
```

## Required Structure

Your repo must have a `baselines/` folder:

```
baselines/
├── manifest.json
├── screen-01/
│   ├── baseline.png
│   └── screen.json
└── screen-02/
    ├── baseline.png
    └── screen.json
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run AI Gatekeeper
  run: npx ai-gate run --baseURL http://localhost:3000

- name: Upload evidence
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: ai-gate-evidence
    path: .ai-gate/evidence/
```

See full CI setup: [GitHub Actions Workflow](../../docs/github-actions/ai-gate.yml)

## Documentation

- [Customer Installation Guide](../../CUSTOMER_INSTALL.md) - Full setup instructions
- [Policy Guide](../../POLICY_GUIDE.md) - Threshold and policy configuration
- [Main README](../../README.md) - Project overview

## Exit Codes

The CLI is designed to block CI/CD pipelines on visual drift:

- **Exit 0** - PASS or WARN (allows merge)
- **Exit 1** - FAIL (blocks merge)

This ensures visual regressions don't reach production.

## Support

- GitHub Issues: https://github.com/YOUR-ORG/ai-gatekeeper/issues
- CLI Help: `npx ai-gate --help`
