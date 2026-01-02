# Changes: Harness Validation Implementation

## Summary

Added harness validation scripts and CI integration to prove that the AI Output Gate correctly detects meaningful visual drift and avoids false confidence.

## New Files

### Scripts
- `scripts/harness-regression-check.ts` - Main validation script that tests baseline and regression cases
- `scripts/harness-regression-check.test.ts` - Unit tests for validation logic
- `scripts/README.md` - Documentation for all scripts in the repository

### CI/CD
- `.github/workflows/ci.yml` - GitHub Actions workflow with two jobs:
  - `test`: Runs on all PRs (typecheck, lint, test, build)
  - `regression-validation`: Runs on main branch only (full validation + evidence upload)

### Documentation
- `HARNESS_VALIDATION.md` - Complete guide to the harness validation system
- `HARNESS_VALIDATION_SUMMARY.md` - Implementation summary and file manifest
- `HARNESS_CHECKLIST.md` - Implementation checklist and verification steps
- `CHANGES.md` - This file

## Modified Files

### package.json
Added script:
```json
"harness:regression-check": "concurrently --kill-others --success first \"pnpm demo:start\" \"wait-on http://localhost:5173 && tsx scripts/harness-regression-check.ts\""
```

### README.md
Added two sections:
1. Step 5 in "Demo App Setup" referencing `pnpm harness:regression-check`
2. New "Harness Validation" section before "License" explaining the validation system

## Key Features

### 1. Automated Validation
The `harness:regression-check` command runs four validation checks:
- Baseline gate run (no regressions) → expects PASS
- Button padding regression on screen-03 → expects FAIL
- Missing banner regression on screen-07 → expects FAIL
- Font size regression on screen-10 → expects FAIL

### 2. CI Integration
- **PRs**: Fast checks only (2-3 minutes)
- **Main branch**: Full validation including regression checks (5-8 minutes)
- Evidence artifacts uploaded for debugging

### 3. Regression Test Cases
Leverages existing demo app support for `VITE_REGRESSION_CASE`:
- `button-padding`: Increases button padding on screen-03
- `missing-banner`: Hides banner on screen-07
- `font-size`: Increases heading size on screen-10

### 4. Clear Output
```
╔════════════════════════════════════════════════════════════════╗
║  AI Output Gate - Harness Regression Validation               ║
╚════════════════════════════════════════════════════════════════╝

ℹ️  Starting regression validation checks...
▶️  Step 1: Running gate without regressions (should PASS)
✅ Baseline gate check PASSED
...
✅ All regression validation checks PASSED! 🎉
```

## Testing

### Run Validation
```bash
pnpm harness:regression-check
```

### Run Unit Tests
```bash
pnpm test scripts/harness-regression-check.test.ts
```

### Manual Regression Testing
```bash
VITE_REGRESSION_CASE=button-padding pnpm demo:start
```

## Benefits

1. **Confidence**: Proves gate detects real visual changes
2. **No False Negatives**: Verifies meaningful drift isn't missed
3. **Precision**: Ensures failures on correct screens
4. **Regression Prevention**: Guards against gate itself regressing
5. **Documentation**: Executable specification of expected behavior
6. **CI Safety**: Main branch quality without slowing PR feedback

## Verification

All implementations verified:
- ✅ Build succeeds without errors
- ✅ Unit tests pass
- ✅ Scripts execute successfully
- ✅ Documentation complete
- ✅ CI configuration valid

## Next Steps

To use the harness validation:

1. Generate baselines (if not done):
   ```bash
   pnpm generate:baselines
   ```

2. Run validation:
   ```bash
   pnpm harness:regression-check
   ```

3. Verify all checks pass with green checkmarks

4. Commit and push to see CI validation in action

## Files Tree

```
.
├── .github/
│   └── workflows/
│       └── ci.yml (NEW)
├── scripts/
│   ├── harness-regression-check.ts (NEW)
│   ├── harness-regression-check.test.ts (NEW)
│   └── README.md (NEW)
├── CHANGES.md (NEW)
├── HARNESS_CHECKLIST.md (NEW)
├── HARNESS_VALIDATION.md (NEW)
├── HARNESS_VALIDATION_SUMMARY.md (NEW)
├── README.md (MODIFIED)
└── package.json (MODIFIED)
```

## Compatibility

- Node.js 18+
- pnpm 8+
- Playwright (Chromium)
- Works with existing demo app
- No breaking changes to existing functionality
