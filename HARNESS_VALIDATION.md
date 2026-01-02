# Harness Validation & Regression Testing

This document describes the harness validation system that proves the AI Output Gate correctly detects meaningful visual drift and avoids false confidence.

## Overview

The harness validation system runs automated regression checks to ensure:
1. **Baseline passes**: The gate passes when there are no changes
2. **Meaningful changes are detected**: The gate fails when intentional visual regressions are introduced
3. **Correct screen targeting**: Failures occur on the expected screens

## Regression Cases

Three regression cases are implemented to test different types of visual drift:

### 1. Button Padding (`button-padding`)
- **Target Screen**: screen-03
- **Change**: Increases primary button padding from `px-4 py-2` to `px-8 py-6`
- **Purpose**: Tests detection of spacing/layout changes
- **Expected Result**: FAIL on screen-03

### 2. Missing Banner (`missing-banner`)
- **Target Screen**: screen-07
- **Change**: Hides the banner component completely
- **Purpose**: Tests detection of missing UI elements
- **Expected Result**: FAIL on screen-07

### 3. Font Size (`font-size`)
- **Target Screen**: screen-10
- **Change**: Increases heading size from `text-3xl` to `text-5xl`
- **Purpose**: Tests detection of typography changes
- **Expected Result**: FAIL on screen-10

## Running Regression Checks

### Command

```bash
pnpm harness:regression-check
```

This command:
1. Starts the demo app
2. Runs baseline gate check (should PASS)
3. Runs each regression case and verifies:
   - Gate fails (returns non-zero exit code)
   - Correct screen is flagged as FAIL
   - Other screens remain PASS

### Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║  AI Output Gate - Harness Regression Validation               ║
╚════════════════════════════════════════════════════════════════╝

ℹ️  Starting regression validation checks...
ℹ️  Demo app directory: /path/to/examples/demo-app
ℹ️  Base URL: http://localhost:5173

▶️  Step 1: Running gate without regressions (should PASS)
✅ Baseline gate check PASSED

▶️  Step: Testing regression case "button-padding" - Increased button padding on screen 03
✅ Regression case "button-padding" correctly detected on screen-03

▶️  Step: Testing regression case "missing-banner" - Hidden banner component on screen 07
✅ Regression case "missing-banner" correctly detected on screen-07

▶️  Step: Testing regression case "font-size" - Increased heading font size on screen 10
✅ Regression case "font-size" correctly detected on screen-10

================================================================
✅ All regression validation checks PASSED! 🎉
================================================================
```

## Implementation Details

### Demo App Integration

The demo app's `ScreenPage.tsx` component reads the `VITE_REGRESSION_CASE` environment variable and applies conditional rendering:

```typescript
const regressionCase = import.meta.env.VITE_REGRESSION_CASE || '';

const hasButtonPaddingRegression = isScreen03 && regressionCase === 'button-padding';
const hasMissingBannerRegression = isScreen07 && regressionCase === 'missing-banner';
const hasFontSizeRegression = isScreen10 && regressionCase === 'font-size';
```

### Validation Script

The `scripts/harness-regression-check.ts` script:
1. Runs gate without regression flags
2. Verifies PASS status
3. For each regression case:
   - Sets the appropriate environment variable
   - Runs gate
   - Verifies FAIL status
   - Checks that the expected screen failed
   - Parses JSON output for programmatic validation

### Exit Codes

- **0**: All validation checks passed
- **1**: One or more validation checks failed

## CI Integration

### GitHub Actions Workflow

The `.github/workflows/ci.yml` includes a `regression-validation` job that:
- Only runs on the `main` branch (not on PRs)
- Installs dependencies and Playwright
- Executes `pnpm harness:regression-check`
- Uploads evidence artifacts for debugging

### Why Main Branch Only?

Running regression validation on every PR would slow down the CI pipeline. Instead:
- PRs run: type checking, linting, unit tests, and builds
- Main branch runs: all of the above + regression validation

This keeps PR feedback fast while ensuring main branch quality.

## Testing

Unit tests for the regression validation logic are in `scripts/harness-regression-check.test.ts`:

```bash
pnpm test scripts/harness-regression-check.test.ts
```

Tests verify:
- Regression case configuration
- Expected behavior definitions
- Validation logic
- Integration points
- Error handling scenarios

## Troubleshooting

### Baseline Check Fails

If the baseline check (no regression) fails:
1. Verify baselines are generated: `pnpm generate:baselines`
2. Check for unintended changes in the demo app
3. Review the evidence pack in `.ai-gate/evidence/`

### Regression Not Detected

If a regression case passes when it should fail:
1. Verify the environment variable is set correctly
2. Check that the demo app is reading `VITE_REGRESSION_CASE`
3. Review the diff images to see if changes are below threshold
4. Consider adjusting thresholds in `ai-gate.config.json`

### Wrong Screen Fails

If a different screen fails than expected:
1. Check that screen IDs match between baselines and test
2. Verify the regression logic targets the correct screen number
3. Review evidence for unexpected cross-screen effects

## Evidence Artifacts

After running regression checks, evidence packs are stored in:
```
examples/demo-app/.ai-gate/evidence/
```

Each run creates a timestamped ZIP containing:
- Screenshots (actual vs. baseline)
- Diff images highlighting changes
- SHA-256 hashes
- HTML report

In CI, these are uploaded as artifacts for 7 days.

## Benefits

This validation system provides:

1. **Confidence**: Proves the gate detects real visual changes
2. **No False Negatives**: Verifies meaningful drift isn't missed
3. **Precision**: Ensures failures occur on the correct screens
4. **Regression Prevention**: Guards against the gate itself regressing
5. **Documentation**: Serves as executable specification of expected behavior

## Future Enhancements

Potential improvements:
- Add more regression case types (colors, borders, shadows)
- Test edge cases (animations, dynamic content)
- Add performance benchmarks
- Implement snapshot testing for evidence packs
- Add visual regression UI for reviewing results
