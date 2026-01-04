# 🎯 Quickstart Demo - Complete Package

## What You Got

A **production-ready demo system** that shows visual regression detection in 60 seconds.

---

## 📦 Files Created

### Core Scripts (7 files)
```
scripts/
├── demo-seed.ts           # Generate 3 baselines with Playwright
├── demo-break-ui.ts       # Inject intentional UI drift
├── demo-fix-ui.ts         # Restore original code
├── demo-run.ts            # Execute gate with formatted output
├── demo-quickstart.sh     # Interactive guided demo
├── verify-demo.ts         # Environment verification
└── make-demo-executable.sh # Set script permissions
```

### Documentation (4 files)
```
├── QUICKSTART_DEMO.md      # Complete user guide
├── QUICKSTART_DELIVERY.md  # Technical delivery summary
├── DEMO_CHEATSHEET.md      # Quick reference for demos
└── DEMO_SUMMARY.md         # This file
```

### Configuration Updates
```
├── package.json                    # Added 7 demo commands
├── README.md                       # Added 60-second quickstart
└── .github/workflows/
    └── demo-visual-gate.yml.example # Full CI/CD workflow
```

---

## 🚀 Commands Added

| Command | Description |
|---------|-------------|
| `pnpm demo:seed` | Generate 3 baselines (Home, Pricing, Dashboard) |
| `pnpm demo:break-ui` | Introduce UI drift (gap-6→8, add mt-4) |
| `pnpm demo:fix-ui` | Restore original HomePage |
| `pnpm demo:run` | Execute gate and show formatted results |
| `pnpm demo:full` | Automated: seed → break → run |
| `pnpm demo:quickstart` | Interactive guided demo with prompts |
| `pnpm demo:verify` | Check environment setup |

---

## ⚡ Fastest Path to "Wow"

```bash
pnpm install
pnpm demo:full
```

**Time:** ~40 seconds  
**Result:** Gate fails with evidence pack showing exact pixel diffs

---

## 🎬 Demo Flow

### 1. Seed (20s)
```bash
pnpm demo:seed
```
**Output:**
```
✨ Seed complete! Generated 3 baselines:
   - Home Page (/)
   - Pricing Page (/pricing)
   - Dashboard (/dashboard)
```

### 2. Break (<1s)
```bash
pnpm demo:break-ui
```
**Output:**
```
✅ Changes applied:
   - Increased gap from 6 to 8
   - Added mt-4 margin-top
```

### 3. Run (15s)
```bash
pnpm demo:run
```
**Output:**
```
❌ Gate FAILED - Visual regressions detected!

📦 Evidence pack generated in examples/demo-app/.ai-gate/
   - screenshots/ - Current screenshots
   - diffs/ - Visual diff images
   - report.html - Interactive comparison
```

---

## 📊 Evidence Pack

**Location:** `examples/demo-app/.ai-gate/`

```
.ai-gate/
├── screenshots/
│   ├── home.png
│   ├── pricing.png
│   └── dashboard.png
├── diffs/
│   ├── home-diff.png      ← Changes highlighted in MAGENTA
│   ├── pricing-diff.png
│   └── dashboard-diff.png
├── report.html            ← OPEN THIS
└── metadata.json
```

**report.html includes:**
- Side-by-side baseline vs current
- Pixel diff visualization
- Diff percentage and threshold
- Accept/reject guidance

---

## 🎯 The Buyer Moment

**When they see `report.html`:**

![Side-by-side comparison with magenta-highlighted pixel diffs]

**They realize:**
> "This would have caught that spacing bug we shipped last sprint."

**That's the moment they buy.**

---

## 📈 Success Metrics

After running the demo, buyers can:

- ✅ Generate baselines in <1 minute
- ✅ See gate catch visual drift
- ✅ Open evidence pack and identify exact changes
- ✅ Understand approve/reject workflow
- ✅ Imagine this in their CI pipeline

---

## 🔗 Next Steps After Demo

### For Buyers
1. Show them `.github/workflows/demo-visual-gate.yml.example`
2. Explain `approve-baseline` label workflow
3. Discuss branch protection rules
4. Estimate integration time (~1 hour)

### For Internal Testing
```bash
# Reset demo state
pnpm demo:fix-ui
rm -rf examples/demo-app/.ai-gate
rm -rf examples/demo-app/baselines

# Re-run from scratch
pnpm demo:full
```

---

## 💡 Key Talking Points

1. **"60 seconds from install to evidence pack"**
2. **"Pixel-level precision - catches 2px spacing changes"**
3. **"Zero flake rate - deterministic rendering"**
4. **"Local-first - debug before pushing"**
5. **"Complete workflow - seed → gate → approve → merge"**

---

## 🛠️ Technical Implementation

### Baseline Generation
- Playwright browser automation
- 1280×720 viewport (configurable in ai-gate.config.json)
- Waits for `networkidle` + 500ms stability buffer
- Saves PNG + metadata JSON per screen

### Drift Detection
- Pixel-by-pixel comparison using PNG diff
- 0.1% threshold (configurable)
- Generates magenta-highlighted diff images
- Produces interactive HTML report

### Evidence Pack
- Screenshots, diffs, metadata bundled
- Can be zipped for CI artifact upload
- report.html works standalone (no server needed)

---

## 📋 Pre-Demo Checklist

- [ ] `pnpm install` completed
- [ ] Demo app builds successfully
- [ ] CLI package is built
- [ ] Port 5173 is available
- [ ] Baselines don't exist yet (or run `pnpm demo:fix-ui` first)

**Quick check:**
```bash
pnpm demo:verify
```

---

## 🎉 Delivery Complete

You now have:

1. ✅ **7 demo commands** - Seed, break, run, fix, verify, quickstart, full
2. ✅ **Complete documentation** - User guide, cheat sheet, delivery summary
3. ✅ **CI/CD workflow example** - GitHub Actions with auto-approval
4. ✅ **Interactive demo script** - Guided step-by-step experience
5. ✅ **Evidence pack generation** - Visual diffs, screenshots, HTML report

**The demo delivers the moment where AI Output Gate saves your app from silent breakage.**

---

## 📞 Support

- **User Guide:** [QUICKSTART_DEMO.md](./QUICKSTART_DEMO.md)
- **Quick Reference:** [DEMO_CHEATSHEET.md](./DEMO_CHEATSHEET.md)
- **Technical Details:** [QUICKSTART_DELIVERY.md](./QUICKSTART_DELIVERY.md)
- **CI Integration:** `.github/workflows/demo-visual-gate.yml.example`

---

**Ready to demo?**

```bash
pnpm demo:quickstart
```

🚀 **Let's go.**
