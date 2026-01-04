# AI Gatekeeper: Landing Page Copy

Clean, minimal landing page focused on developer experience and immediate value.

---

## Hero Section

### Headline
```
Catch Visual Bugs Before They Ship
```

### Subheadline
```
AI-powered visual regression testing for your PRs.  
Set up in 5 minutes. Zero config. No surprises in production.
```

### CTA Buttons

**Primary CTA:**
```
Get Started — Free Template
[Links to: https://github.com/your-org/ai-gate-template-nextjs]
```

**Secondary CTA:**
```
Watch 90-Second Demo
[Opens video modal or links to demo video]
```

**Tertiary Link:**
```
View Documentation →
[Links to: GitHub README or docs site]
```

---

## Features Section

### Section Title
```
Visual Regression Testing That Just Works
```

### Feature Bullets

#### 1. 🎯 Pixel-Perfect Detection
```
Automatically captures screenshots and compares them to your baselines.  
Detects visual changes down to the pixel—no manual inspection required.
```

#### 2. ⚡ 5-Minute Setup
```
Clone our Next.js template, run npm install, and you're live.  
No complex configuration, no custom scripts. Works out of the box.
```

#### 3. 🔍 Visual Diff Artifacts
```
Every PR includes baseline, current, and diff images.  
See exactly what changed, highlighted in red. No guesswork.
```

#### 4. 🚫 Block Breaking PRs
```
Failed visual checks block merges in GitHub Actions.  
Prevent accidental UI regressions from reaching production.
```

#### 5. 🧠 AI-Powered Baseline Management
```
Intelligent suggestions for updating baselines when changes are intentional.  
Reduce false positives and reviewer fatigue.
```

#### 6. 🛠️ Framework Agnostic
```
Works with Next.js, React, Vue, or any web framework.  
Runs on Playwright with Chromium—battle-tested and reliable.
```

---

## How It Works (3-Step Process)

### Section Title
```
Three Steps to Safer Deployments
```

### Step 1: Capture Baselines
```
1️⃣ Capture Baselines
Run `npx ai-gate baseline add` to snapshot your UI.  
Commit baselines to Git alongside your code.
```

### Step 2: Run on Every PR
```
2️⃣ Run on Every PR
GitHub Actions automatically compares new screenshots to baselines.  
Takes 2-3 minutes for 20+ routes. Runs in parallel with your tests.
```

### Step 3: Review Differences
```
3️⃣ Review Differences
Download artifacts to see baseline/current/diff images.  
Approve intentional changes or reject accidental bugs.
```

---

## Social Proof / Trust Section

### Section Title
```
Trusted by Teams Who Ship Fast
```

### Testimonial Placeholders

**Placeholder 1:**
```
"We caught 3 critical UI bugs in the first week. AI Gatekeeper paid for itself immediately."
— Engineering Lead, SaaS Startup
```

**Placeholder 2:**
```
"Setup took 7 minutes. We've prevented 12 regressions since launching. No more 'how did this break?' conversations."
— QA Manager, E-commerce Platform
```

**Placeholder 3:**
```
"Finally, visual testing that doesn't flake. Zero false positives in 200+ runs."
— Senior Developer, Fintech Company
```

---

## Technical Details Section

### Section Title
```
Built for Developers, by Developers
```

### Technical Highlights

- **Language:** TypeScript, Node.js 20+
- **Testing Framework:** Playwright with Chromium
- **CI/CD:** GitHub Actions (works with any CI)
- **Diff Engine:** Pixelmatch (deterministic, pixel-perfect)
- **Artifact Storage:** GitHub Actions artifacts (30-day retention)
- **Baseline Storage:** Git repository (version-controlled)
- **Frameworks Supported:** Next.js, React, Vue, Angular, vanilla JS
- **License:** MIT (open source)

---

## FAQ Section

### 1. How is this different from Percy, Chromatic, or Applitools?

**Answer:**
```
AI Gatekeeper is open-source, self-hosted, and has zero runtime costs.  
There are no per-screenshot fees, no vendor lock-in, and no usage limits.  

Percy/Chromatic charge $149-$499/month for basic plans. AI Gatekeeper runs  
in your GitHub Actions for free (within GitHub's free tier of 2,000 minutes/month).

You own the data, control the infrastructure, and can customize the engine.
```

---

### 2. Does this work with my existing test suite?

**Answer:**
```
Yes. AI Gatekeeper runs as a separate CI step and doesn't interfere with  
your unit tests, integration tests, or E2E tests.

It's designed to complement tools like Jest, Vitest, Playwright Test, and Cypress.  
You can run visual regression checks in parallel with your existing test suite.
```

---

### 3. How do I update baselines when I intentionally change the UI?

**Answer:**
```
Two options:

1. **Manual update:** Run `npx ai-gate baseline update <screen-id>` locally,  
   review the diff, and commit the new baseline.

2. **AI suggestion:** AI Gatekeeper analyzes the diff and suggests whether  
   the change looks intentional (e.g., button text change, color update).  
   Approve with one click in the PR comment.

Both methods require explicit approval—no auto-updates.
```

---

### 4. What if my app has dynamic content (timestamps, user names, random data)?

**Answer:**
```
Use **masks** to exclude dynamic regions from comparison:

```json
{
  "id": "dashboard",
  "route": "/dashboard",
  "masks": [
    {"selector": ".timestamp", "reason": "Dynamic timestamp"},
    {"selector": ".user-avatar", "reason": "User-specific image"}
  ]
}
```

Masks black out specified areas before comparison, so only static UI is checked.

AI Gatekeeper can also auto-suggest masks for common patterns (timestamps, IDs, etc.).
```

---

### 5. How fast is it? Will it slow down my CI?

**Answer:**
```
**Speed:** ~5-10 seconds per screenshot (including page load, rendering, capture).  
**Example:** 20 routes = 2-3 minutes total (screenshots run in parallel).

For context:
- Chromatic: Similar speed (~3-5 min for 20 screens)
- Percy: ~4-6 min (depends on their server queue)
- Manual QA: 30+ minutes per release

AI Gatekeeper runs in parallel with your existing tests, so it adds minimal  
overhead to total CI time. Most teams see <5 minute increase.
```

---

## Pricing Section

### Section Title
```
Transparent Pricing (Spoiler: It's Free)
```

### Pricing Table

| Feature | AI Gatekeeper | Percy | Chromatic | Applitools |
|---------|---------------|-------|-----------|------------|
| **Screenshots/month** | Unlimited | 5,000 | 5,000 | 1,000 |
| **Monthly cost** | $0 | $149 | $149 | $199 |
| **Self-hosted** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Open source** | ✅ MIT | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary |
| **CI integration** | GitHub Actions (free tier) | Any CI | Any CI | Any CI |
| **Data ownership** | You own it | Vendor-hosted | Vendor-hosted | Vendor-hosted |
| **Custom threshold** | ✅ Configurable | ❌ Fixed | ✅ Configurable | ✅ Configurable |

**Note:** GitHub Actions free tier includes 2,000 minutes/month. AI Gatekeeper  
typically uses 2-5 minutes per PR. That's 400-1000 PRs/month for free.

---

## Final CTA Section

### Section Title
```
Ship with Confidence. Start in 5 Minutes.
```

### CTA Buttons (Same as Hero)

**Primary CTA:**
```
Get Started — Free Template
[Links to: https://github.com/your-org/ai-gate-template-nextjs]
```

**Secondary CTA:**
```
Read the Docs
[Links to: GitHub README or docs site]
```

**Tertiary Link:**
```
Join Discord Community →
[Links to: Discord server for support]
```

---

## Footer Section

### Links

**Product:**
- Documentation
- Template Repository
- GitHub Issues
- Changelog

**Resources:**
- Quick Start Guide
- GitHub Actions Setup
- Troubleshooting
- API Reference

**Community:**
- Discord
- GitHub Discussions
- Twitter
- LinkedIn

**Legal:**
- MIT License
- Privacy Policy
- Terms of Service

### Copyright
```
© 2026 AI Gatekeeper. Open-source software licensed under MIT.
```

---

## Meta Tags (For SEO)

```html
<meta name="description" content="AI-powered visual regression testing for your PRs. Catch UI bugs before they ship. Free, open-source, and works with any framework.">
<meta name="keywords" content="visual regression testing, screenshot testing, UI testing, automated testing, GitHub Actions, Next.js, React, Playwright">
<meta property="og:title" content="AI Gatekeeper — Catch Visual Bugs Before They Ship">
<meta property="og:description" content="AI-powered visual regression testing. 5-minute setup. Zero config. Free and open-source.">
<meta property="og:image" content="https://ai-gatekeeper.dev/og-image.png">
<meta property="og:url" content="https://ai-gatekeeper.dev">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="AI Gatekeeper — Visual Regression Testing">
<meta name="twitter:description" content="Catch UI bugs before they ship. Free, open-source, works with any framework.">
<meta name="twitter:image" content="https://ai-gatekeeper.dev/twitter-card.png">
```

---

## Design Notes

### Layout
- **Hero:** Full-screen with centered text and video embed
- **Features:** 3-column grid (2 columns on tablet, 1 on mobile)
- **How It Works:** Horizontal stepper with icons
- **FAQ:** Accordion-style (collapsed by default)
- **Pricing:** Comparison table (horizontal scroll on mobile)

### Visual Style
- **Color scheme:** Purple/blue gradient (matches GitHub Actions theme)
- **Typography:** Inter or System UI (clean, readable)
- **Code blocks:** Syntax highlighting with copy button
- **Animations:** Subtle fade-in on scroll, no heavy transitions
- **Icons:** Lucide React or Heroicons (consistent icon set)

### Accessibility
- **Contrast ratio:** WCAG AAA (7:1 minimum)
- **Keyboard navigation:** Full support for all CTAs
- **Screen reader:** Semantic HTML, ARIA labels where needed
- **Mobile-first:** Responsive design, touch-friendly buttons (48px min)

---

## Content Guidelines

### Voice and Tone
- **Direct:** No marketing fluff, get to the point
- **Developer-focused:** Use technical terms, show code examples
- **Confident:** Avoid "try to", "might", "hopefully"
- **Practical:** Emphasize speed, ease, and results

### Writing Rules
- **Short sentences:** Max 20 words per sentence
- **Active voice:** "AI Gatekeeper detects bugs" (not "Bugs are detected")
- **Specific numbers:** "5 minutes" (not "a few minutes")
- **Avoid jargon:** Explain acronyms on first use

### Forbidden Phrases
- ❌ "Revolutionary", "game-changer", "disruptive"
- ❌ "Best-in-class", "industry-leading", "cutting-edge"
- ❌ "Easy", "simple", "just" (show, don't tell)
- ❌ "Try it today", "Don't miss out", "Limited time"

### Preferred Phrases
- ✅ "Set up in 5 minutes"
- ✅ "Zero config"
- ✅ "Pixel-perfect detection"
- ✅ "Open-source and self-hosted"

---

## A/B Testing Variants

Test these headline variations:

**Variant A (Current):**
```
Catch Visual Bugs Before They Ship
```

**Variant B (Outcome-focused):**
```
Stop Shipping Broken UIs
```

**Variant C (Speed-focused):**
```
Visual Regression Testing in 5 Minutes
```

**Variant D (Cost-focused):**
```
Free Visual Testing for Every PR
```

**Success metric:** Click-through rate to template repository (target >8%)

---

## Launch Checklist

Before going live:
- ✅ All links work (no 404s)
- ✅ Video demo embedded and plays correctly
- ✅ Code examples have syntax highlighting
- ✅ Mobile layout tested on iOS and Android
- ✅ Page load time <2 seconds (Lighthouse score >90)
- ✅ Meta tags render correctly on Twitter/LinkedIn share preview
- ✅ Analytics tracking installed (Google Analytics or Plausible)
- ✅ HTTPS certificate valid
- ✅ Favicon and app icons present

---

## Future Enhancements

After initial launch:
- Add **interactive demo** (Stackblitz embed where users can run AI Gatekeeper)
- Add **case studies** (replace placeholder testimonials with real customer stories)
- Add **comparison calculator** (input your screenshot count → see cost savings vs Percy/Chromatic)
- Add **live status page** (show uptime, latest release, community stats)
- Add **newsletter signup** (monthly updates, new features, tips)
