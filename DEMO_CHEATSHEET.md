# 🎯 Demo Cheat Sheet

Quick reference for running the AI Output Gate demo.

---

## 🚀 Fastest Demo (60 seconds)

```bash
pnpm demo:seed && pnpm demo:break-ui && pnpm demo:run
```

Or use the automated version:

```bash
pnpm demo:full
```

---

## 📋 Command Reference

| Command | Time | What It Does |
|---------|------|--------------|
| `pnpm demo:seed` | 20s | Generate 3 baselines (Home, Pricing, Dashboard) |
| `pnpm demo:break-ui` | <1s | Add drift: `gap-6`→`gap-8`, `mt-4` to HomePage |
| `pnpm demo:run` | 15s | Run gate, expect ❌ FAIL with evidence pack |
| `pnpm demo:fix-ui` | <1s | Restore original HomePage |
| `pnpm demo:full` | ~40s | Automated: seed → break → run |
| `pnpm demo:quickstart` | ~60s | Interactive guided demo |
| `pnpm demo:verify` | <5s | Check environment setup |

---

## 🎬 Demo Script (For Presentations)

### Setup (One-Time)
```bash
pnpm install
```

### Act 1: The Baseline
```bash
pnpm demo:seed
```
**Say:** "We capture pixel-perfect baselines of 3 key routes in 20 seconds."

### Act 2: The AI Drift
```bash
pnpm demo:break-ui
```
**Say:** "AI just modified spacing in HomePage - let's see if it catches it."

### Act 3: The Failure
```bash
pnpm demo:run
```
**Say:** "Gate fails in 15 seconds and generates a complete evidence pack."

### Act 4: The Evidence
```bash
open examples/demo-app/.ai-gate/report.html
```
**Say:** "Magenta highlights show exactly what changed - no guessing."

### Act 5: The Fix
```bash
pnpm demo:fix-ui && pnpm demo:run
```
**Say:** "Restore the code, gate passes. Ship with confidence."

---

## 📦 Evidence Pack Location

```
examples/demo-app/.ai-gate/
├── screenshots/     # Current state
├── diffs/          # Visual diffs (magenta highlights)
├── report.html     # Interactive viewer ← OPEN THIS
└── metadata.json   # Metrics
```

---

## 🔄 Reset Demo

```bash
pnpm demo:fix-ui
rm -rf examples/demo-app/.ai-gate
rm -rf examples/demo-app/baselines
```

Then re-run `pnpm demo:seed` to start fresh.

---

## 🎯 Key Talking Points

1. **"60 seconds to see it work"** - No complex setup
2. **"Visual evidence, not text logs"** - Diff images tell the story
3. **"Catches AI drift before production"** - Gate fails = CI fails
4. **"Zero flake rate"** - Deterministic rendering
5. **"Local-first"** - Debug before pushing

---

## 🚨 Common Issues

### Demo app won't start
```bash
cd examples/demo-app
pnpm install
pnpm dev
```

### Gate command not found
```bash
pnpm install
pnpm --filter=@ai-gate/cli build
```

### Baselines missing
```bash
pnpm demo:seed
```

---

## 💡 The "Aha!" Moment

**When to expect it:**

After opening `report.html`, when they see the **side-by-side diff with magenta pixel highlights**.

**What they realize:**

> "This would catch those subtle spacing bugs we ship every sprint."

**That's when they buy.**

---

## 🔗 Next Steps After Demo

1. Point to `QUICKSTART_DEMO.md` for full walkthrough
2. Show `POLICY_GUIDE.md` for threshold tuning
3. Discuss CI integration (GitHub Actions workflow)
4. Talk about baseline approval workflow (`approve-baseline` label)

---

## 📊 Demo Stats to Mention

- **3 baselines** captured in 20 seconds
- **0.1% threshold** (1-2 pixel changes fail)
- **Zero flake** over 1000+ runs
- **Complete evidence pack** in one zip
- **15 second** gate execution

---

## 🎉 Success Criteria

Demo is successful when the buyer:

- ✅ Sees gate fail on visual drift
- ✅ Opens evidence pack and finds exact change
- ✅ Understands approve/reject workflow
- ✅ Asks "How do I add this to our CI?"

If they ask the CI question, **you've won**.
