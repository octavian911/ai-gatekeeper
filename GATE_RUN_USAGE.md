# Gate Run Command

The `gate run` command executes visual regression testing against a specified base URL, comparing actual screenshots against baseline images.

## Usage

```bash
ai-gate gate run --baseURL <url> [options]
```

## Required Options

- `--baseURL <url>` - The base URL to test against (e.g., `http://localhost:3000`)

## Optional Options

- `--ci` - CI mode: Exit with code 1 if any screen fails (default: false)
- `--outDir <dir>` - Custom output directory for run results (default: `runs/<runId>`)
- `--screens <ids>` - Comma-separated list of screen IDs to test (default: all screens)

## Examples

### Basic run against localhost
```bash
ai-gate gate run --baseURL http://localhost:3000
```

### CI mode (fails on any FAIL status)
```bash
ai-gate gate run --baseURL http://localhost:3000 --ci
```

### Test specific screens only
```bash
ai-gate gate run --baseURL http://localhost:3000 --screens homepage,dashboard
```

### Custom output directory
```bash
ai-gate gate run --baseURL http://localhost:3000 --outDir ./my-test-run
```

## Behavior

For each screen in `baselines/manifest.json` (or filtered by `--screens`):

1. **Load Configuration** - Reads screen configuration from `baselines/<screenId>/screen.json`
2. **Navigate** - Opens `baseURL + screen.url` in a deterministic browser
3. **Prepare Page** - Calls `prepareDeterministicPage()` to stabilize the page
4. **Apply Masks** - Applies configured masks:
   - **CSS masks**: Hides elements by setting `opacity: 0`
   - **Rect masks**: Overlays fixed position rectangles
5. **Capture Screenshot** - Takes a full-page screenshot at the configured viewport
6. **Compare** - Compares actual vs baseline using pixelmatch
7. **Compute Metrics**:
   - `diffPixels` - Number of different pixels
   - `diffPixelRatio` - Ratio of different pixels to total pixels
   - `totalPixels` - Total pixels in the image
   - `originalityPercent` - Percentage match (100% - diffRatio)
8. **Resolve Thresholds** - Determines thresholds from global, tag, and screen-specific settings
9. **Evaluate Status**:
   - **FAIL** if:
     - Error during navigation/capture
     - `diffPixelRatio > fail.maxDiffPixelRatio` OR `diffPixels > fail.maxDiffPixels`
     - `requireMasks` is true and no masks are configured
   - **WARN** if:
     - `diffPixelRatio > warn.maxDiffPixelRatio` OR `diffPixels > warn.maxDiffPixels`
   - **PASS** otherwise

## Output Artifacts

### Directory Structure
```
runs/<runId>/
├── summary.json              # Run summary with all results
├── report.html               # Static HTML report viewer
└── per-screen/
    └── <screenId>/
        ├── expected.png      # Baseline image
        ├── actual.png        # Captured screenshot
        ├── diff.png          # Diff image (if not PASS)
        ├── result.json       # Individual screen result
        └── debug.json        # Debug info (if GATE_DEBUG=1)
```

### summary.json

```json
{
  "runId": "run-1234567890",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "sha": "abc123...",
  "branch": "main",
  "total": 5,
  "passed": 3,
  "warned": 1,
  "failed": 1,
  "results": [
    {
      "screenId": "homepage",
      "name": "Homepage",
      "url": "/",
      "status": "PASS",
      "diffPixels": 42,
      "diffPixelRatio": 0.00015,
      "totalPixels": 921600,
      "originalityPercent": 99.9985,
      "thresholds": {
        "warn": { "diffPixelRatio": 0.0002, "diffPixels": 250 },
        "fail": { "diffPixelRatio": 0.0005, "diffPixels": 600 }
      },
      "expectedPath": "runs/.../per-screen/homepage/expected.png",
      "actualPath": "runs/.../per-screen/homepage/actual.png"
    }
  ]
}
```

### result.json (per screen)

```json
{
  "screenId": "dashboard",
  "name": "Dashboard Page",
  "url": "/dashboard",
  "status": "WARN",
  "diffPixels": 325,
  "diffPixelRatio": 0.00035,
  "totalPixels": 921600,
  "originalityPercent": 99.9965,
  "thresholds": {
    "warn": { "diffPixelRatio": 0.0002, "diffPixels": 250 },
    "fail": { "diffPixelRatio": 0.0005, "diffPixels": 600 }
  },
  "expectedPath": ".../expected.png",
  "actualPath": ".../actual.png",
  "diffPath": ".../diff.png"
}
```

## Exit Codes

- **0** - All screens passed, or warnings/failures but not in `--ci` mode
- **1** - Any screen failed and `--ci` mode is enabled

## Error Handling

If a screen fails to load (404, timeout, etc.):
- Status is set to `FAIL`
- Error message is stored in `result.error`
- Debug screenshot is saved (if page loaded partially)
- Debug info is saved if `GATE_DEBUG=1` environment variable is set

## Status Evaluation Logic

```javascript
function evaluateStatus(input) {
  // Check for errors first
  if (input.error) return 'FAIL';
  
  // Check requireMasks rule
  if (input.thresholds.requireMasks && (!input.masks || input.masks.length === 0)) {
    return 'FAIL';
  }
  
  // Check fail thresholds (OR logic)
  if (input.diffPixelRatio > input.thresholds.fail.diffPixelRatio ||
      input.diffPixels > input.thresholds.fail.diffPixels) {
    return 'FAIL';
  }
  
  // Check warn thresholds (OR logic)
  if (input.diffPixelRatio > input.thresholds.warn.diffPixelRatio ||
      input.diffPixels > input.thresholds.warn.diffPixels) {
    return 'WARN';
  }
  
  return 'PASS';
}
```

## Masks

Masks are defined in `baselines/<screenId>/screen.json`:

```json
{
  "name": "Homepage",
  "url": "/",
  "tags": ["noisy"],
  "masks": [
    {
      "type": "css",
      "selector": ".dynamic-timestamp"
    },
    {
      "type": "rect",
      "x": 100,
      "y": 200,
      "width": 300,
      "height": 50
    }
  ]
}
```

- **CSS masks**: Hides all elements matching the selector
- **Rect masks**: Overlays a black rectangle at the specified coordinates

## Thresholds

Thresholds are resolved in this order (later overrides earlier):
1. Global defaults
2. Tag-specific overrides (first tag only)
3. Screen-specific overrides

### Global Defaults
```javascript
{
  warn: { diffPixelRatio: 0.0002, diffPixels: 250 },
  fail: { diffPixelRatio: 0.0005, diffPixels: 600 }
}
```

### Tag Overrides
- `critical`: Stricter thresholds
- `noisy`: More lenient thresholds + `requireMasks: true`

### Screen-Specific
Defined in `baselines/<screenId>/screen.json`:
```json
{
  "thresholds": {
    "warn": { "diffPixelRatio": 0.0001, "diffPixels": 100 },
    "fail": { "diffPixelRatio": 0.0003, "diffPixels": 400 }
  }
}
```

## HTML Report

The static HTML report (`report.html`) includes:
- Overall summary with PASS/WARN/FAIL counts
- Git SHA and branch (if available)
- Per-screen results with status badges
- Side-by-side image comparisons (for WARN/FAIL)
- Diff visualizations
- Threshold information
- Error messages (for failures)

## Debug Mode

Set `GATE_DEBUG=1` to enable debug mode:
```bash
GATE_DEBUG=1 ai-gate gate run --baseURL http://localhost:3000
```

Debug mode captures:
- Console errors
- Failed network requests
- Additional diagnostics in `debug.json`
