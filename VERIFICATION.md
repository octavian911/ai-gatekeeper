# Verification Checklist

This document tracks the "90% ready" targets for Phase 1.

## Performance Targets

- [ ] **Flake Rate ≤ 1%**: Run nightly workflow 200+ times
  - Current: _Not yet measured_
  - Target: ≤ 1% false failures on identical UI

- [ ] **Runtime ≤ 5 minutes**: 20 screens on GitHub Actions
  - Current: _Not yet measured_
  - Target: Complete gate run in ≤ 5 minutes on ubuntu-latest

- [ ] **False FAIL ≤ 2%**: No-change runs
  - Current: _Not yet measured_
  - Target: ≤ 2% false positives when UI is unchanged

- [ ] **Onboarding ≤ 15 minutes**: Clone → baseline → PR comment
  - Current: _Not yet measured_
  - Target: New user can set up and see PR comment in ≤ 15 minutes

## Functional Requirements

- [x] **CLI Commands**
  - [x] baseline add
  - [x] baseline list
  - [x] baseline validate
  - [x] baseline update
  - [x] gate run
  - [x] gate pack
  - [x] masks suggest

- [x] **Deterministic Rendering**
  - [x] Animations disabled
  - [x] Fixed viewport (1280x720)
  - [x] External network blocked
  - [x] Stable waits (networkidle)
  - [x] Date mocking

- [x] **Artifacts**
  - [x] Expected/actual/diff PNGs
  - [x] summary.json
  - [x] report.html
  - [x] evidence.zip with hashes

- [x] **GitHub Actions Workflows**
  - [x] PR gate workflow
  - [x] Baseline approval workflow
  - [x] Nightly flake workflow

- [x] **Demo Harness**
  - [x] 20 routes
  - [x] Regression toggles (?regression=true)
  - [x] Known dynamic elements

- [ ] **Unit Tests**
  - [x] Policy logic tests
  - [ ] Comparison logic tests
  - [ ] Baseline manager tests

## Measurement Scripts

### Measure Flake Rate

```bash
#!/bin/bash
cd packages/cli

RUNS=200
FAILURES=0

for i in $(seq 1 $RUNS); do
  echo "Run $i/$RUNS"
  if ! pnpm cli gate run > /dev/null 2>&1; then
    FAILURES=$((FAILURES + 1))
  fi
done

FLAKE_RATE=$(echo "scale=4; $FAILURES / $RUNS" | bc)
echo "Flake Rate: $FLAKE_RATE (Target: ≤ 0.01)"
```

### Measure Runtime

```bash
#!/bin/bash
cd packages/cli

START=$(date +%s)
pnpm cli gate run
END=$(date +%s)

DURATION=$((END - START))
echo "Runtime: ${DURATION}s (Target: ≤ 300s)"
```

### Measure False Positives

```bash
#!/bin/bash
cd packages/cli

RUNS=100
FALSE_POSITIVES=0

# Capture baseline
pnpm cli baseline add

for i in $(seq 1 $RUNS); do
  echo "Run $i/$RUNS"
  # No UI changes, should always pass
  if ! pnpm cli gate run > /dev/null 2>&1; then
    FALSE_POSITIVES=$((FALSE_POSITIVES + 1))
  fi
done

FALSE_POSITIVE_RATE=$(echo "scale=4; $FALSE_POSITIVES / $RUNS" | bc)
echo "False Positive Rate: $FALSE_POSITIVE_RATE (Target: ≤ 0.02)"
```

## Sign-off

When all checkboxes are checked and metrics meet targets, Phase 1 is complete.
