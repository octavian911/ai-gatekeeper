# Org-wide Policy Configuration (.gate/policy.json)

## Overview

The `.gate/policy.json` file allows teams to set strict organization-wide defaults for visual regression testing. This ensures consistent, deterministic testing across all screens while still allowing per-screen overrides when needed (with proper justification).

## Key Benefits

1. **Set defaults once**: Configure viewport, determinism settings, and thresholds organization-wide
2. **Automatic tag assignment**: Auto-apply "critical" or "noisy" tags based on route patterns
3. **Strict enforcement**: Prevent teams from accidentally loosening thresholds without justification
4. **Mask coverage guardrails**: Prevent over-masking that could hide legitimate regressions
5. **Audit trail**: Track when and why thresholds are loosened with required justifications

## Policy File Location

Create the policy file at:
```
.gate/policy.json
```

## Schema

```json
{
  "schemaVersion": 1,
  "defaults": {
    "viewport": {
      "width": 1280,
      "height": 720
    },
    "determinism": {
      "browser": "chromium",
      "deviceScaleFactor": 1,
      "locale": "en-US",
      "timezoneId": "UTC",
      "colorScheme": "light",
      "reduceMotion": "reduce",
      "disableAnimations": true,
      "blockExternalNetwork": true,
      "waitUntil": "networkidle",
      "layoutStabilityMs": 300,
      "screenshotAfterSettledOnly": true
    },
    "thresholds": {
      "standard": {
        "warn": {
          "diffPixelRatio": 0.0002,
          "diffPixels": 250
        },
        "fail": {
          "diffPixelRatio": 0.0005,
          "diffPixels": 600
        }
      },
      "critical": {
        "warn": {
          "diffPixelRatio": 0.0001,
          "diffPixels": 150
        },
        "fail": {
          "diffPixelRatio": 0.0003,
          "diffPixels": 400
        }
      },
      "noisy": {
        "warn": {
          "diffPixelRatio": 0.0003,
          "diffPixels": 350
        },
        "fail": {
          "diffPixelRatio": 0.0008,
          "diffPixels": 900
        },
        "requireMasks": true
      }
    }
  },
  "tagRules": {
    "criticalRoutes": ["/login", "/checkout", "/pricing"],
    "noisyRoutes": ["/dashboard", "/reports"]
  },
  "enforcement": {
    "allowLoosening": false,
    "allowPerScreenViewportOverride": true,
    "allowPerScreenMaskOverride": true,
    "maxMaskCoverageRatio": 0.35
  }
}
```

## Configuration Options

### defaults.viewport
- `width`: Default viewport width (pixels)
- `height`: Default viewport height (pixels)

### defaults.determinism

Essential settings for deterministic rendering:

- `browser`: Browser engine (`"chromium"`, `"firefox"`, or `"webkit"`)
- `deviceScaleFactor`: Pixel density (1 = standard, 2 = retina)
- `locale`: Browser locale for consistent text rendering
- `timezoneId`: Timezone for date/time rendering
- `colorScheme`: `"light"` or `"dark"` mode
- `reduceMotion`: `"reduce"` or `"no-preference"`
- `disableAnimations`: Must be `true` for deterministic screenshots
- `blockExternalNetwork`: Must be `true` to prevent external resource flakes
- `waitUntil`: Navigation wait strategy (`"networkidle"` recommended)
- `layoutStabilityMs`: Milliseconds to wait for layout stability
- `screenshotAfterSettledOnly`: Wait for layout stability before capturing

### defaults.thresholds

Three threshold tiers for different screen types:

**standard**: Default for most screens
- `warn`: Warning threshold (diff detected but not critical)
- `fail`: Failure threshold (unacceptable diff)

**critical**: Stricter thresholds for critical flows
- Lower tolerance for pixel differences
- Use for login, checkout, payment flows

**noisy**: Relaxed thresholds for dynamic content
- Higher tolerance for expected changes
- `requireMasks`: Forces mask usage for noisy screens

Each threshold has:
- `diffPixelRatio`: Maximum allowed ratio of different pixels (0.0002 = 0.02%)
- `diffPixels`: Maximum absolute number of different pixels

### tagRules

Automatic tag assignment based on URL patterns:

- `criticalRoutes`: Array of URL substrings that trigger "critical" tag
- `noisyRoutes`: Array of URL substrings that trigger "noisy" tag

**Precedence**: 
1. Explicit screen tags (in `baselines/<id>/screen.json`)
2. Critical route matches
3. Noisy route matches
4. Standard (no tag)

### enforcement

Strict enforcement rules:

- `allowLoosening`: If `false`, per-screen overrides **cannot** loosen thresholds
  - Per-screen can only make thresholds **stricter** (smaller ratios/pixels)
  - Prevents accidental weakening of quality gates
  - If `true`, loosening requires `overrideJustification` field
  
- `allowPerScreenViewportOverride`: Allow screens to override viewport size

- `allowPerScreenMaskOverride`: Allow screens to define custom masks

- `maxMaskCoverageRatio`: Maximum fraction of screen that can be masked (0.35 = 35%)
  - Prevents over-masking that could hide real regressions
  - Violations cause screen to FAIL with coverage ratio in evidence

## Resolution Precedence

Policy resolution follows strict precedence order:

```
1. Core baked defaults (hardcoded in code)
   ↓
2. .gate/policy.json (organization policy)
   ↓
3. Tag rules (auto-apply tags based on URL)
   ↓
4. Tag thresholds (critical/noisy/standard)
   ↓
5. Per-screen overrides (baselines/<id>/screen.json)
```

## Per-Screen Overrides

Individual screens can override policy settings in `baselines/<id>/screen.json`:

```json
{
  "name": "Dashboard",
  "url": "/dashboard",
  "tags": ["noisy"],
  "viewport": {
    "width": 1920,
    "height": 1080
  },
  "thresholds": {
    "warn": {
      "diffPixelRatio": 0.0001
    }
  },
  "masks": [
    {
      "type": "css",
      "selector": ".live-data"
    }
  ]
}
```

### Tightening vs. Loosening

**Tightening** (always allowed):
- Smaller `diffPixelRatio` values
- Smaller `diffPixels` values
- Setting `requireMasks: true`

**Loosening** (requires enforcement.allowLoosening=true + justification):
- Larger `diffPixelRatio` values
- Larger `diffPixels` values
- Setting `requireMasks: false`

Example loosening with justification:

```json
{
  "name": "Analytics Dashboard",
  "url": "/analytics",
  "thresholds": {
    "fail": {
      "diffPixelRatio": 0.001,
      "diffPixels": 1000
    }
  },
  "overrideJustification": "Real-time charts cause unavoidable pixel differences"
}
```

## Strict Enforcement Rules

### No Silent Loosening

When `enforcement.allowLoosening = false` (default):
- Per-screen overrides **cannot** increase thresholds
- Gate run **fails** if loosening is attempted
- Error message clearly explains the violation

### Justification Required

When `enforcement.allowLoosening = true`:
- Loosening requires `overrideJustification` field in screen.json
- Justification is recorded in `summary.json`
- Provides audit trail for why quality gates were relaxed

### Essential Stabilizers

These settings cannot be disabled unless `allowLoosening=true` + justification:
- `disableAnimations`: Must remain `true`
- `blockExternalNetwork`: Must remain `true`

This prevents teams from accidentally introducing flakes.

### Mask Coverage Limit

Prevents "masking everything" to game the gate:
- Default limit: 35% of viewport area
- Calculated from `rect` masks (CSS masks estimated at runtime)
- Screens exceeding limit **FAIL** with coverage ratio in evidence
- Adjustable via `enforcement.maxMaskCoverageRatio`

## CLI Commands

### Validate Policy

```bash
pnpm gate policy validate
```

Validates `.gate/policy.json` and shows resolved configuration:
- Schema validation
- Resolved defaults
- Tag rules
- Enforcement settings
- Warnings for overlapping tag rules

### Run with Policy

```bash
pnpm gate run --baseURL http://localhost:5173
```

Automatically loads and applies `.gate/policy.json` if present:
- Resolves per-screen configuration
- Enforces strict rules
- Tracks loosening in `summary.json`
- Calculates policy hash for reproducibility

## Run Summary Output

When policy is active, `runs/<run-id>/summary.json` includes:

```json
{
  "runId": "run-1234567890",
  "timestamp": "2024-01-15T12:00:00Z",
  "total": 20,
  "passed": 18,
  "warned": 1,
  "failed": 1,
  "policyHash": "a1b2c3d4e5f6g7h8",
  "looseningOccurred": true,
  "looseningJustifications": [
    {
      "screenId": "screen-05",
      "justification": "Real-time charts cause unavoidable pixel differences"
    }
  ],
  "results": [...]
}
```

## Example Policies

### Strict Enterprise Policy

```json
{
  "schemaVersion": 1,
  "defaults": {
    "viewport": { "width": 1920, "height": 1080 },
    "determinism": {
      "browser": "chromium",
      "deviceScaleFactor": 2,
      "locale": "en-US",
      "timezoneId": "UTC",
      "colorScheme": "light",
      "reduceMotion": "reduce",
      "disableAnimations": true,
      "blockExternalNetwork": true,
      "waitUntil": "networkidle",
      "layoutStabilityMs": 500,
      "screenshotAfterSettledOnly": true
    },
    "thresholds": {
      "standard": {
        "warn": { "diffPixelRatio": 0.0001, "diffPixels": 100 },
        "fail": { "diffPixelRatio": 0.0002, "diffPixels": 200 }
      },
      "critical": {
        "warn": { "diffPixelRatio": 0.00005, "diffPixels": 50 },
        "fail": { "diffPixelRatio": 0.0001, "diffPixels": 100 }
      },
      "noisy": {
        "warn": { "diffPixelRatio": 0.0002, "diffPixels": 200 },
        "fail": { "diffPixelRatio": 0.0005, "diffPixels": 500 },
        "requireMasks": true
      }
    }
  },
  "tagRules": {
    "criticalRoutes": ["/login", "/checkout", "/payment", "/pricing"],
    "noisyRoutes": ["/dashboard", "/analytics", "/reports", "/activity"]
  },
  "enforcement": {
    "allowLoosening": false,
    "allowPerScreenViewportOverride": false,
    "allowPerScreenMaskOverride": true,
    "maxMaskCoverageRatio": 0.25
  }
}
```

### Flexible Development Policy

```json
{
  "schemaVersion": 1,
  "defaults": {
    "viewport": { "width": 1280, "height": 720 },
    "determinism": {
      "browser": "chromium",
      "deviceScaleFactor": 1,
      "locale": "en-US",
      "timezoneId": "UTC",
      "colorScheme": "light",
      "reduceMotion": "reduce",
      "disableAnimations": true,
      "blockExternalNetwork": true,
      "waitUntil": "networkidle",
      "layoutStabilityMs": 300,
      "screenshotAfterSettledOnly": true
    },
    "thresholds": {
      "standard": {
        "warn": { "diffPixelRatio": 0.0003, "diffPixels": 300 },
        "fail": { "diffPixelRatio": 0.0008, "diffPixels": 800 }
      },
      "critical": {
        "warn": { "diffPixelRatio": 0.0002, "diffPixels": 200 },
        "fail": { "diffPixelRatio": 0.0005, "diffPixels": 500 }
      },
      "noisy": {
        "warn": { "diffPixelRatio": 0.0005, "diffPixels": 500 },
        "fail": { "diffPixelRatio": 0.001, "diffPixels": 1200 },
        "requireMasks": true
      }
    }
  },
  "tagRules": {
    "criticalRoutes": ["/login", "/checkout"],
    "noisyRoutes": ["/dashboard"]
  },
  "enforcement": {
    "allowLoosening": true,
    "allowPerScreenViewportOverride": true,
    "allowPerScreenMaskOverride": true,
    "maxMaskCoverageRatio": 0.4
  }
}
```

## Best Practices

1. **Start strict**: Begin with `allowLoosening: false` to establish baseline quality
2. **Use tag rules**: Automatically classify screens instead of manual tagging
3. **Monitor justifications**: Review `looseningJustifications` in summary.json regularly
4. **Limit mask coverage**: Keep `maxMaskCoverageRatio` ≤ 0.35 to prevent gaming
5. **Centralize determinism**: Set determinism settings once in policy, not per-screen
6. **Version control policy**: Commit `.gate/policy.json` and track changes in code review
7. **Document exceptions**: Require clear justifications when loosening is needed

## Troubleshooting

### Policy Validation Fails

```bash
pnpm gate policy validate
```

Check for:
- Invalid schema version
- `maxMaskCoverageRatio` outside 0-1 range
- Overlapping tag rules (warning, not error)

### Screen Rejected: "threshold override rejected"

Your per-screen override is loosening thresholds:
1. Check if `enforcement.allowLoosening` is `false`
2. Add `overrideJustification` field if loosening is required
3. Consider if you can tighten per-screen thresholds instead

### Screen Rejected: "mask coverage exceeds policy limit"

Your masks cover too much of the screen:
1. Review masks in `baselines/<id>/screen.json`
2. Remove unnecessary masks
3. Use more precise CSS selectors instead of large rect masks
4. Consider if screen truly needs that many masks

### Gate Run Ignores Policy

Policy file must be at exact path:
```
.gate/policy.json
```

Not:
- `.gate/policy.yaml`
- `gate/policy.json`
- `.gate-policy.json`

## Migration Guide

### From No Policy to Policy

1. Create `.gate/policy.json` with current defaults
2. Run `pnpm gate policy validate` to verify
3. Run `pnpm gate run` to ensure all screens pass
4. Gradually tighten thresholds over time

### Enabling Strict Enforcement

1. Review current per-screen overrides
2. Set `enforcement.allowLoosening: false`
3. Run gate to identify loosening violations
4. Either tighten those screens or add justifications

### Adding Tag Rules

1. Analyze current screen URLs
2. Add tag rules for common patterns
3. Remove explicit tags from `screen.json` files
4. Verify tags are applied correctly with `pnpm gate policy validate`

## FAQ

**Q: Can I have multiple policy files?**
A: No, only `.gate/policy.json` is supported. Use git branches for environment-specific policies.

**Q: What happens if policy.json is missing?**
A: Gate uses core hardcoded defaults. Everything still works.

**Q: Can per-screen settings override determinism?**
A: Yes, but only with `allowLoosening: true` + `overrideJustification` for essential fields.

**Q: How is mask coverage calculated for CSS masks?**
A: CSS masks are estimated at runtime by measuring element bounding boxes. Rect masks use exact dimensions.

**Q: Can I disable the mask coverage limit?**
A: Set `maxMaskCoverageRatio: 1.0` to effectively disable it (not recommended).

**Q: Does policy affect baseline generation?**
A: No, policy only applies during `gate run`. Baseline generation uses screen.json settings directly.
