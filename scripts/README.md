# Scripts Documentation

This directory contains utility scripts for the AI Output Gate project.

## Available Scripts

### Harness Regression Check

**File**: `harness-regression-check.ts`

Validates that the visual regression gate correctly detects meaningful UI drift.

```bash
pnpm harness:regression-check
```

**What it does**:
1. Runs baseline gate check (no regressions) - expects PASS
2. Tests button padding regression on screen-03 - expects FAIL
3. Tests missing banner regression on screen-07 - expects FAIL
4. Tests font size regression on screen-10 - expects FAIL

**Exit codes**:
- `0`: All validation checks passed
- `1`: One or more checks failed

**Requirements**:
- Demo app must be running on `http://localhost:5173`
- Baselines must be generated
- Uses `concurrently` to manage app lifecycle

See [HARNESS_VALIDATION.md](../HARNESS_VALIDATION.md) for full documentation.

---

### Generate Demo Baselines

**File**: `generate-demo-baselines.ts`

Generates baseline screenshots for all 20 demo app screens.

```bash
pnpm generate:baselines
```

**What it does**:
1. Connects to demo app at `http://localhost:5173`
2. Captures screenshots for all configured routes
3. Saves baselines to `baselines/` directory
4. Updates `manifest.json` with metadata

**Requirements**:
- Demo app must be running
- Uses `concurrently` to manage app lifecycle

---

### Generate Screen Configs

**File**: `generate-screen-configs.ts`

Generates screen configuration files for all 20 demo app screens.

```bash
tsx scripts/generate-screen-configs.ts
```

**What it does**:
1. Creates `screen.json` for each screen in `baselines/screen-XX/`
2. Includes metadata like tags and description
3. Adds special tags for dynamic content (clock, quote, banner)

---

### Create Placeholder Baselines

**File**: `create-placeholder-baselines.ts`

Creates placeholder baseline files and directory structure.

```bash
tsx scripts/create-placeholder-baselines.ts
```

**What it does**:
1. Creates `baselines/` directory structure
2. Generates `manifest.json` with screen metadata
3. Creates placeholder `screen.json` files

**Note**: This creates the structure but not actual screenshots. Run `generate:baselines` to capture real screenshots.

---

### Verify Setup

**File**: `verify-setup.sh`

Verifies the project setup and dependencies.

```bash
pnpm verify
```

**What it does**:
1. Checks Node.js and pnpm versions
2. Verifies package installations
3. Confirms build artifacts exist
4. Validates baseline directory structure

---

## Running Tests

All TypeScript scripts have corresponding test files:

```bash
# Run all script tests
pnpm test scripts/

# Run specific test
pnpm test scripts/harness-regression-check.test.ts
```

## Development

Scripts use:
- **tsx**: TypeScript execution
- **Node.js built-ins**: `fs/promises`, `path`, `child_process`
- **Playwright**: Browser automation (via `@ai-gate/core`)

## CI Usage

In GitHub Actions:
- `harness-regression-check.ts` runs on `main` branch after PRs merge
- `verify-setup.sh` runs in all CI jobs for sanity checks
- Evidence artifacts are uploaded on failures

## Troubleshooting

### Script Hangs

If a script hangs:
1. Check if demo app is running on the expected port
2. Verify `wait-on` timeout settings in `package.json`
3. Kill orphaned processes: `pkill -f vite`

### Permission Errors

If you get permission errors:
1. Make scripts executable: `chmod +x scripts/*.sh`
2. Or run with explicit interpreter: `bash scripts/verify-setup.sh`

### Import Errors

If TypeScript imports fail:
1. Build packages: `pnpm build`
2. Verify `tsconfig.json` paths configuration
3. Check that `@ai-gate/*` packages are built
