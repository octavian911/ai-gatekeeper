# 🚀 Quickstart Demo

**See AI Output Gate catch visual regressions in 60 seconds.**

This demo shows the complete workflow: baseline creation → UI drift → gate failure → evidence pack.

---

## Prerequisites

```bash
pnpm install
```

---

## 🎯 Two Ways to Run

### Option A: Interactive Script (Recommended)

```bash
pnpm demo:quickstart
```

The script will guide you through each step with prompts.

### Option B: Manual Steps

Run each command individually (shown below).

---

## 🎬 The 3-Step Demo

### 1️⃣ Seed Baselines (20 seconds)

Generate 3 baseline screenshots (Home, Pricing, Dashboard):

```bash
pnpm demo:seed
```

**What happens:**
- Launches demo app on `localhost:5173`
- Captures 3 screenshots at 1280×720
- Saves to `examples/demo-app/baselines/`

**Output:**
```
✨ Seed complete! Generated 3 baselines:
   - Home Page (/)
   - Pricing Page (/pricing)
   - Dashboard (/dashboard)
```

---

### 2️⃣ Break the UI (instant)

Introduce intentional visual drift:

```bash
pnpm demo:break-ui
```

**What happens:**
- Modifies `HomePage.tsx`: changes `gap-6` → `gap-8` and adds `mt-4`
- Simulates AI code generation drift

**Output:**
```
✅ Changes applied:
   - Increased gap from 6 to 8
   - Added mt-4 margin-top

These changes will cause visual regression failures.
```

---

### 3️⃣ Run the Gate (15 seconds)

Execute visual regression check:

```bash
pnpm demo:run
```

**What happens:**
- Launches demo app
- Runs `gate run` against baselines
- Generates evidence pack with diffs

**Expected output:**
```
❌ Gate FAILED - Visual regressions detected!

📦 Evidence pack generated in examples/demo-app/.ai-gate/
   - screenshots/ - Current screenshots
   - diffs/ - Visual diff images
   - report.html - Interactive comparison

🔧 To approve these changes:
   1. Review the diff images
   2. Run `pnpm gate baseline --update` to accept
   3. Or run `pnpm demo:fix-ui` to restore original
```

---

## 📦 Evidence Pack Contents

Open `examples/demo-app/.ai-gate/report.html` to see:

- **Side-by-side comparison**: Baseline vs Current
- **Pixel diff visualization**: Highlighted changes in magenta
- **Diff metrics**: Pixel count, percentage, threshold status
- **Actionable next steps**: Approve or reject

---

## 🔄 Complete Workflow Demo

Run all steps automatically:

```bash
pnpm demo:full
```

This executes: `seed` → `break-ui` → `run` in sequence.

---

## 🛠️ Restore Original State

Undo the intentional drift:

```bash
pnpm demo:fix-ui
```

Then verify tests pass:

```bash
pnpm demo:run
```

**Expected:**
```
✅ Gate PASSED - No visual regressions detected
```

---

## 🎯 Key Takeaways

1. **Baseline creation is instant** – 3 screens in ~20 seconds
2. **Failures are visual** – Diff images show exactly what changed
3. **Evidence is comprehensive** – Screenshots + diffs + HTML report in one zip
4. **Workflow is simple** – Seed → Gate → Review → Approve/Reject

---

## 🔗 Next Steps

### Local Development
- Add your own screens to `ai-gate.config.json`
- Run `pnpm gate baseline --update` to capture new baselines
- Integrate into your dev workflow

### CI Integration
- Add `.github/workflows/visual-regression.yml`
- Gate fails → CI fails → blocks merge
- Add `approve-baseline` label → auto-updates baselines

### Production Setup
See [POLICY_GUIDE.md](./POLICY_GUIDE.md) for threshold tuning and mask configuration.

---

## 💡 The "Aha!" Moment

**You don't buy tools. You buy moments.**

This demo gives buyers the moment where:
1. AI generates code
2. Visual drift happens
3. Gate catches it **before production**
4. Evidence pack shows **exactly what changed**

That's the moment AI Output Gate saves your app from silent breakage.
