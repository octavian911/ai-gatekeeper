# 🚀 Quickstart Demo - README

## One Command Demo

```bash
pnpm demo:full
```

**Time:** 40 seconds  
**Result:** Visual regression caught with evidence pack

---

## What This Does

1. **Seeds 3 baselines** - Home, Pricing, Dashboard screenshots
2. **Breaks the UI** - Adds intentional spacing drift to HomePage
3. **Runs the gate** - Detects changes and generates evidence pack

**Output:**
```
❌ Gate FAILED - Visual regressions detected!

📦 Evidence pack in examples/demo-app/.ai-gate/
   - screenshots/ - Current state
   - diffs/ - Pixel diffs (magenta highlights)
   - report.html - Interactive comparison
```

---

## Individual Commands

### Generate Baselines
```bash
pnpm demo:seed
```
Creates 3 baseline screenshots in 20 seconds.

### Introduce UI Drift
```bash
pnpm demo:break-ui
```
Modifies HomePage: `gap-6` → `gap-8`, adds `mt-4`

### Run Visual Gate
```bash
pnpm demo:run
```
Compares current UI to baselines, generates evidence pack.

### Restore Original
```bash
pnpm demo:fix-ui
```
Removes the intentional drift.

### Interactive Demo
```bash
pnpm demo:quickstart
```
Guided walkthrough with prompts at each step.

### Verify Setup
```bash
pnpm demo:verify
```
Checks that baselines exist and CLI is ready.

---

## View Evidence

After running `pnpm demo:run`:

```bash
open examples/demo-app/.ai-gate/report.html
```

**You'll see:**
- Side-by-side baseline vs current
- Pixel diff with magenta highlights
- Diff percentage and threshold status
- Clear approve/reject guidance

---

## Reset Demo

```bash
pnpm demo:fix-ui
rm -rf examples/demo-app/.ai-gate
rm -rf examples/demo-app/baselines
```

Then run `pnpm demo:seed` to start fresh.

---

## Full Documentation

- **[QUICKSTART_DEMO.md](./QUICKSTART_DEMO.md)** - Complete user guide
- **[DEMO_CHEATSHEET.md](./DEMO_CHEATSHEET.md)** - Quick reference
- **[QUICKSTART_DELIVERY.md](./QUICKSTART_DELIVERY.md)** - Technical details
- **[DEMO_SUMMARY.md](./DEMO_SUMMARY.md)** - Package overview

---

## CI/CD Integration

See `.github/workflows/demo-visual-gate.yml.example` for a complete GitHub Actions workflow with:

- ✅ PR-based visual regression checks
- 📦 Evidence pack artifact uploads
- 💬 Auto-comments on PRs
- 🏷️ `approve-baseline` label workflow
- 🚫 Merge blocking on failures

---

## Quick Troubleshooting

**Demo app won't start:**
```bash
cd examples/demo-app && pnpm install && pnpm dev
```

**Gate command not found:**
```bash
pnpm install && pnpm build
```

**Port 5173 in use:**
```bash
lsof -ti:5173 | xargs kill -9
```

---

## The "Aha!" Moment

When you open `report.html` and see **side-by-side diffs with magenta pixel highlights**, you realize:

> "This would catch those subtle bugs we ship every sprint."

**That's when it clicks.**

---

**Ready? Let's go:**

```bash
pnpm demo:full
```

🎯 See visual regression detection in action.
