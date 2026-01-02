# Harness Validation Implementation Summary

This document summarizes the harness validation system added to prove that the AI Output Gate correctly detects meaningful visual drift.

## What Was Added

### 1. Regression Test Cases (Already in Demo App)

The demo app (`examples/demo-app/src/pages/ScreenPage.tsx`) already supports three regression cases via `VITE_REGRESSION_CASE` environment variable:

- **button-padding**: Increases button padding on screen-03 (px-4 py-2 → px-8 py-6)
- **missing-banner**: Hides banner component on screen-07
- **font-size**: Increases heading size on screen-10 (text-3xl → text-5xl)

### 2. Validation Script

**File**: `scripts/harness-regression-check.ts`

Automated test runner that:
1. Runs baseline gate check (expects PASS)
2. Tests each regression case individually (expects FAIL on correct screen)
3. Verifies failures occur on expected screens
4. Provides clear pass/fail output with emojis
5. Exits with appropriate status code

### 3. NPM Script

**Added to `package.json`**:
```json
"harness:regression-check": "concurrently --kill-others --success first \"pnpm demo:start\" \"wait-on http://localhost:5173 && tsx scripts/harness-regression-check.ts\""
```

**Usage**:
```bash
pnpm harness:regression-check
```

### 4. CI Configuration

**File**: `.github/workflows/ci.yml`

Two jobs:
- **test**: Runs on all PRs and main (typecheck, lint, test, build)
- **regression-validation**: Runs on main branch only (slower, prevents PR slowdown)

The regression-validation job:
- Installs dependencies and Playwright
- Runs `pnpm harness:regression-check`
- Uploads evidence artifacts for debugging

### 5. Unit Tests

**File**: `scripts/harness-regression-check.test.ts`

Tests covering:
- Regression case configuration
- Expected behavior definitions
- Validation logic
- Integration points
- Error handling

### 6. Documentation

**Files**:
- `HARNESS_VALIDATION.md`: Full documentation of the validation system
- `scripts/README.md`: Scripts reference guide
- Updated `README.md`: Added harness validation section

## Command Reference

```bash
# Run full validation suite
pnpm harness:regression-check

# Run unit tests for validation script
pnpm test scripts/harness-regression-check.test.ts

# Manual testing of individual regression cases
VITE_REGRESSION_CASE=button-padding pnpm demo:start
VITE_REGRESSION_CASE=missing-banner pnpm demo:start
VITE_REGRESSION_CASE=font-size pnpm demo:start
```

## Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║  AI Output Gate - Harness Regression Validation               ║
╚════════════════════════════════════════════════════════════════╝

ℹ️  Starting regression validation checks...

▶️  Step 1: Running gate without regressions (should PASS)
✅ Baseline gate check PASSED

▶️  Step: Testing regression case "button-padding"...
✅ Regression case "button-padding" correctly detected on screen-03

▶️  Step: Testing regression case "missing-banner"...
✅ Regression case "missing-banner" correctly detected on screen-07

▶️  Step: Testing regression case "font-size"...
✅ Regression case "font-size" correctly detected on screen-10

================================================================
✅ All regression validation checks PASSED! 🎉
================================================================
```

## CI Integration Strategy

**Why main branch only?**

Running regression validation on every PR would slow down feedback cycles. The strategy:

- **PRs**: Fast checks (lint, typecheck, unit tests, build) - ~2-3 minutes
- **Main**: Full validation including regression checks - ~7-10 minutes

This keeps PR iterations fast while ensuring main branch quality through comprehensive validation.

## Files Modified

```
Modified:
- package.json (added harness:regression-check command)
- README.md (added harness validation section)

Created:
- .github/workflows/ci.yml
- scripts/harness-regression-check.ts
- scripts/harness-regression-check.test.ts
- scripts/README.md
- HARNESS_VALIDATION.md
- HARNESS_VALIDATION_SUMMARY.md (this file)
```

## Testing the Implementation

### Step 1: Run Validation Locally

```bash
# Ensure baselines exist
pnpm generate:baselines

# Run validation
pnpm harness:regression-check
```

### Step 2: Run Unit Tests

```bash
pnpm test scripts/harness-regression-check.test.ts
```

### Step 3: Test CI Locally (Optional)

```bash
# Install act (GitHub Actions local runner)
brew install act  # or your package manager

# Run CI workflow locally
act -j regression-validation
```

## Success Criteria

The harness validation proves:

1. ✅ **No false confidence**: Baseline passes when unchanged
2. ✅ **Detects meaningful drift**: Layout changes (button padding) caught
3. ✅ **Detects missing elements**: Removed components (banner) caught  
4. ✅ **Detects style changes**: Typography changes (font size) caught
5. ✅ **Precision**: Failures occur on expected screens only
6. ✅ **Automation**: Runs in CI on main branch
7. ✅ **Evidence**: Artifacts available for debugging

## Future Enhancements

Potential additions:
- More regression case types (colors, shadows, borders)
- Performance benchmarking of validation runs
- Visual regression UI for reviewing evidence packs
- Slack/Discord notifications on validation failures
- Trend analysis of flake rates over time
