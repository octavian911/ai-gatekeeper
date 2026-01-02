# Demo App Implementation Summary

## Overview

The demo app has been rebuilt as a comprehensive harness for testing the AI Output Gate visual regression system. It includes 20 routes with consistent UI, dynamic elements for masking tests, and regression toggles for validation.

## Architecture

### Route Structure

- **20 routes**: `/screen-01` through `/screen-20`
- **Consistent layout**: Shared navigation, header with clock, and content sections
- **Predictable UI**: Each screen has identical component structure with variations

### Dynamic Elements (For Masking Tests)

1. **Clock** (`data-testid="clock"`)
   - Updates every second
   - Present on all screens in the header
   - Must be masked in all baselines

2. **Quote Block** (`data-testid="quote"`)
   - Rotates quotes every 5 seconds
   - Present on screens: 02, 05, 08, 11, 14, 17, 20
   - Must be masked when present

### Regression Scenarios

Controlled via `VITE_REGRESSION_CASE` environment variable:

1. **`button-padding`** (Screen 03)
   - Changes primary button padding from `px-4 py-2` to `px-8 py-6`
   - Tests button dimension changes

2. **`missing-banner`** (Screen 07)
   - Hides the welcome banner
   - Tests missing element detection

3. **`font-size`** (Screen 10)
   - Changes heading from `text-3xl` to `text-5xl`
   - Tests text size changes

## Files Created

### Demo App Source

- `examples/demo-app/src/App.tsx` - Route definitions
- `examples/demo-app/src/components/Layout.tsx` - Navigation and header
- `examples/demo-app/src/components/Clock.tsx` - Dynamic clock component
- `examples/demo-app/src/components/QuoteBlock.tsx` - Rotating quote component
- `examples/demo-app/src/components/Banner.tsx` - Welcome banner
- `examples/demo-app/src/pages/ScreenPage.tsx` - Main screen template
- `examples/demo-app/screens.json` - Screen metadata for baseline generation
- `examples/demo-app/ai-gate.config.json` - Gate configuration

### Baseline Structure

```
baselines/
├── README.md                    # Documentation
├── manifest.json                # Index of all baselines
├── screen-01/
│   ├── baseline.png            # Screenshot (placeholder until generated)
│   └── screen.json             # Screen config with masks
├── screen-02/
│   ├── baseline.png
│   └── screen.json
└── ... (through screen-20)
```

### Scripts

- `scripts/generate-demo-baselines.ts` - Automated baseline capture script
- `scripts/generate-screen-configs.ts` - Generates screen.json files
- `scripts/create-placeholder-baselines.ts` - Creates placeholder PNGs

### Package Scripts

- `pnpm demo:start` - Start demo app on port 5173
- `pnpm harness:run-once` - Run full harness (start app + gate run)
- `pnpm generate:baselines` - Generate real baseline screenshots
- `pnpm setup:baselines` - Create placeholder files and configs

## Baseline Configuration

### Mask Strategy

All screens mask the clock. Screens with quotes also mask the quote block:

```json
{
  "name": "Screen 02",
  "url": "/screen-02",
  "tags": ["with-quote"],
  "masks": [
    {
      "type": "css",
      "selector": "[data-testid=\"clock\"]"
    },
    {
      "type": "css",
      "selector": "[data-testid=\"quote\"]"
    }
  ]
}
```

### Tags

- `with-banner` - Screens with welcome banner (01, 04, 07, 10, 13, 16, 19)
- `with-quote` - Screens with quote block (02, 05, 08, 11, 14, 17, 20)
- `regression-*` - Regression test targets (03, 07, 10)

## Usage

### Generate Baselines

```bash
# From repository root
pnpm install
pnpm build
pnpm setup:baselines      # Create placeholder structure
pnpm generate:baselines   # Capture real screenshots
```

### Run Gate Tests

```bash
# Run complete harness
pnpm harness:run-once

# Or manually
pnpm demo:start
# In another terminal:
pnpm gate run --baseURL http://localhost:5173
```

### Test Regressions

```bash
# Test button padding regression on screen-03
VITE_REGRESSION_CASE=button-padding pnpm demo:start
# Then run gate in another terminal

# Test missing banner regression on screen-07
VITE_REGRESSION_CASE=missing-banner pnpm demo:start

# Test font size regression on screen-10
VITE_REGRESSION_CASE=font-size pnpm demo:start
```

## Test IDs

For reliable element selection and testing:

- `data-testid="clock"` - Dynamic clock
- `data-testid="quote"` - Rotating quote block
- `data-testid="banner"` - Welcome banner
- `data-testid="screen-XX"` - Screen root element
- `data-testid="nav-screen-XX"` - Navigation button
- `data-testid="heading"` - Screen heading
- `data-testid="button-group"` - Button container
- `data-testid="primary-button"` - Primary action button
- `data-testid="secondary-button"` - Secondary action button
- `data-testid="card-N"` - Content cards (1-3)
- `data-testid="stat-N"` - Statistics (0-3)

## Current Status

✅ **Implemented:**
- 20 routes with consistent layout
- Dynamic clock and quote elements
- Regression toggle mechanism
- Baseline structure with manifest.json
- Per-screen mask configurations
- Demo and harness scripts
- Updated README quickstart

📌 **Requires:**
- Running `pnpm generate:baselines` to capture real screenshots
- This requires a working Playwright environment
- Placeholder 1x1 PNGs are committed until real baselines are generated

## Next Steps

1. Run `pnpm install` to install new dependencies (concurrently, wait-on, tsx)
2. Run `pnpm build` to build the packages
3. Run `pnpm setup:baselines` to create baseline structure
4. Run `pnpm generate:baselines` to capture real screenshots
5. Commit the generated baselines with real SHA-256 hashes
