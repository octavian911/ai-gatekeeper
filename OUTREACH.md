# AI Gatekeeper: Outreach Messages

Five targeted outreach messages for engineering and QA leads.

---

## Message 1: Engineering Lead — GitHub Actions User

**Channel:** Email or LinkedIn DM  
**Subject:** "Catch UI bugs in your PRs (5-min setup, zero cost)"  
**Length:** ~150 words  
**Tone:** Technical, direct, outcome-focused

---

### Message

Hi [First Name],

I noticed [Company] uses GitHub Actions for CI. Have you considered adding visual regression testing to your PR workflow?

We built **AI Gatekeeper** to solve this exact problem:
- Automatically captures screenshots of your UI on every PR
- Compares them to baselines and highlights pixel-level differences
- Blocks PRs with visual regressions from merging
- Runs in GitHub Actions (free tier = 400+ PRs/month)

**The setup is stupid simple:**
1. Clone our Next.js template
2. Run `npm install && npm run test:visual`
3. Add the GitHub Actions workflow

Takes 5 minutes. No vendor lock-in, no monthly fees.

We just launched and are looking for early feedback from teams shipping fast. Would you be open to a quick 15-min call to walk through it?

Here's the repo: [github.com/your-org/ai-gate-template-nextjs]

Best,  
[Your Name]

---

**Why this works:**
- Opens with relevance (GitHub Actions user)
- Clear value prop in first paragraph
- Addresses cost concerns upfront
- Low-friction CTA (15-min call vs "sign up now")
- Includes direct link to template

---

## Message 2: Engineering Lead — Recently Had Production Bug

**Channel:** Email or LinkedIn DM  
**Subject:** "RE: [Recent production issue]"  
**Length:** ~120 words  
**Tone:** Empathetic, problem-solving

---

### Message

Hi [First Name],

I saw on [Twitter/LinkedIn/Slack] that [Company] recently dealt with [specific UI bug, e.g., "the broken checkout button"]. That's brutal—sorry to hear it made it to prod.

We built **AI Gatekeeper** to prevent exactly that type of regression:
- Catches visual changes in PRs before they merge
- Shows you baseline/current/diff screenshots
- Runs automatically in GitHub Actions

It's open-source, self-hosted, and takes 5 minutes to set up. No SaaS fees, no screenshot limits.

Would it help if I sent over our Next.js template? You could test it on [specific feature] in under 10 minutes.

Let me know—happy to share a quick demo or just the repo link.

[Your Name]

---

**Why this works:**
- Shows you've done research (mention specific incident)
- Empathizes with their pain point
- Offers immediate, low-commitment value (template)
- Suggests concrete test case (their recent bug scenario)

---

## Message 3: Engineering Lead — SaaS/B2B Product Team

**Channel:** Email  
**Subject:** "Visual regression testing without the Percy/Chromatic bill"  
**Length:** ~180 words  
**Tone:** ROI-focused, competitive

---

### Message

Hi [First Name],

Quick question: Is [Company] currently using Percy, Chromatic, or Applitools for visual testing?

If so, you're probably paying $149-$499/month for basic plans. If not, you're likely doing manual QA or dealing with surprise UI bugs in production.

We just launched **AI Gatekeeper**—an open-source alternative that runs in your GitHub Actions for free:
- ✅ Unlimited screenshots (no per-screenshot fees)
- ✅ Self-hosted (you own the data)
- ✅ 5-minute setup (Next.js template included)
- ✅ Pixel-perfect diffing (Playwright + Pixelmatch)

**The catch:** You host it yourself. But GitHub's free tier gives you 2,000 CI minutes/month—enough for 400+ PRs.

**ROI math:**
- Percy: $1,788/year
- AI Gatekeeper: $0/year (within GitHub free tier)
- Payback period: Immediate

Would you be open to a 10-minute screen share where I show you the setup? Or I can just send the template and you can try it yourself.

Let me know what works.

[Your Name]

---

**Why this works:**
- Leads with competitor comparison (relevant pain point)
- Quantifies ROI ($1,788 saved per year)
- Acknowledges tradeoff (self-hosted) but frames as benefit
- Offers two CTAs (demo or DIY template)

---

## Message 4: QA Lead — Testing Team with E2E Suite

**Channel:** Email or LinkedIn DM  
**Subject:** "Add visual testing to your existing Playwright suite"  
**Length:** ~140 words  
**Tone:** Collaborative, technical

---

### Message

Hi [First Name],

I saw [Company]'s QA team is using Playwright for E2E testing (noticed the job posting/blog post/etc.). Nice setup.

Quick question: Are you also doing visual regression testing, or just functional checks?

We built **AI Gatekeeper** to layer on top of existing Playwright suites:
- Captures screenshots during your E2E runs (or separately)
- Compares them to version-controlled baselines
- Highlights pixel-level diffs in PR artifacts

It's open-source and runs in GitHub Actions. Zero flakiness in 200+ runs so far (deterministic engine = no animation/font rendering issues).

**Setup is 5 minutes:**
Clone template → Run `npm install` → Add GitHub workflow → Done.

Want to see it in action? I can send a 90-second video demo or hop on a quick call.

Either way, here's the repo: [github.com/your-org/ai-gate-template-nextjs]

[Your Name]

---

**Why this works:**
- Validates their existing setup (Playwright)
- Positions as complementary tool, not replacement
- Addresses QA's #1 concern: flakiness
- Offers video demo (lower friction than live call)

---

## Message 5: QA Lead — Manual QA Process

**Channel:** Email  
**Subject:** "Automate visual QA without hiring more engineers"  
**Length:** ~160 words  
**Tone:** Efficiency-focused, empowering

---

### Message

Hi [First Name],

How much time does your QA team spend manually clicking through UI flows before each release?

If it's anything like the teams we've talked to, it's probably 2-4 hours per release—and you're still missing regressions.

We built **AI Gatekeeper** to automate that:
- Captures screenshots of every route/component automatically
- Compares them to approved baselines
- Flags visual differences in PRs (with highlighted diffs)
- Takes 2-3 minutes for 20+ screens

**Your QA team stays in control:**
- They approve baseline updates when changes are intentional
- They review diff artifacts for any failures
- They set thresholds (how much pixel difference is acceptable)

It's open-source, runs in GitHub Actions, and costs $0 (within GitHub's free tier).

**Curious?** I can send a 90-second demo video or a Next.js template you can test in 10 minutes.

Let me know!

[Your Name]

---

**Why this works:**
- Starts with relatable pain point (manual QA time)
- Emphasizes QA retains control (not replacing them)
- Quantifies time savings (2-4 hours → 2-3 minutes)
- Offers two low-friction CTAs (video or template)

---

## Outreach Strategy

### Targeting

**Engineering Leads (Messages 1-3):**
- Companies with 10-100 engineers
- Active GitHub Actions users (check recent CI commits)
- SaaS/B2B products (high deployment frequency)
- Recently had public production bugs (Twitter, status pages)

**QA Leads (Messages 4-5):**
- Companies with dedicated QA teams (5+ QA engineers)
- Using Playwright, Cypress, or Selenium
- Posting QA engineer job openings (signal: scaling QA)
- In industries with strict quality requirements (fintech, healthcare, e-commerce)

### Timing

**Best times to send:**
- **Email:** Tuesday-Thursday, 9-11am recipient's timezone
- **LinkedIn DM:** Monday-Wednesday, 6-8pm (after work hours)
- **Avoid:** Friday afternoons, Monday mornings, holidays

### Follow-Up Sequence

If no response after 1 week:

**Follow-up 1 (Day 7):**
```
Hi [First Name],

Following up on my note about AI Gatekeeper. I know you're busy, so I'll keep this short:

Here's a 90-second video showing how it catches UI bugs in PRs:
[Video link]

And here's the template if you want to test it yourself:
[Template link]

Let me know if you have questions!

[Your Name]
```

**Follow-up 2 (Day 14):**
```
Hi [First Name],

Last follow-up, I promise. 😊

We just added [new feature, e.g., "auto-mask suggestions for dynamic content"] based on feedback from early users.

If visual testing is on your radar for Q1, I'd love to chat. If not, no worries—feel free to ignore.

Repo: [Template link]

[Your Name]
```

**Follow-up 3 (Day 30+):**
```
[Don't send—move to nurture list for quarterly check-ins or product updates]
```

### Personalization Checklist

Before sending, customize:
- ✅ Recipient's first name
- ✅ Company name
- ✅ Specific tech stack detail (GitHub Actions, Playwright, etc.)
- ✅ Recent incident or blog post (if applicable)
- ✅ Relevant use case (e.g., "test it on your checkout flow")

### Success Metrics

Track:
- **Response rate:** Target >15% for cold outreach
- **Demo requests:** Target >5% conversion (response → demo)
- **Template clones:** Track GitHub clones from outreach links
- **Feedback collected:** Aim for 10+ user interviews in first month

### Common Objections and Responses

**Objection 1:** "We already use Percy/Chromatic."  
**Response:**
```
Totally fair—those are solid tools. Out of curiosity, are you hitting their  
screenshot limits or looking to reduce costs? AI Gatekeeper is a good fit if  
you want more control (self-hosted) or unlimited screenshots without the SaaS bill.
```

**Objection 2:** "We don't have time to set this up."  
**Response:**
```
I hear you. The Next.js template is literally clone → npm install → run.  
Takes 5 minutes. If it doesn't work out of the box, I'll help debug over Slack/email.
```

**Objection 3:** "Visual testing is too flaky."  
**Response:**
```
That's the #1 complaint we hear. AI Gatekeeper uses a deterministic engine  
(Playwright + Pixelmatch) with zero animation/font rendering issues. We've  
run 200+ tests with <2% false positive rate. Happy to show you the metrics.
```

**Objection 4:** "Our UI is too dynamic (timestamps, user data, etc.)."  
**Response:**
```
Good point. We support masks to exclude dynamic regions. You just specify  
CSS selectors in your config, and those areas are blacked out before comparison.  
Works great for timestamps, user avatars, live counters, etc.
```

**Objection 5:** "We need approval from [security/legal/procurement]."  
**Response:**
```
Understandable. Since AI Gatekeeper is self-hosted and open-source (MIT license),  
there's no vendor contract, data sharing, or compliance review needed. You own  
the entire stack. Let me know if your team needs any documentation for approval.
```

---

## Email Signature Template

Include at the bottom of all outreach emails:

```
[Your Name]
[Your Title]
AI Gatekeeper

🔗 Template: github.com/your-org/ai-gate-template-nextjs
📹 90-Second Demo: [Video link]
📘 Docs: [Docs site link]
```

---

## LinkedIn Connection Request Template

When sending connection requests before outreach:

```
Hi [First Name], I'm working on an open-source visual testing tool for GitHub Actions.  
Saw [Company] uses Playwright/Next.js and thought you might find it interesting. Would love to connect!
```

**Why this works:**
- Short (LinkedIn truncates at ~300 chars)
- Mentions their tech stack (shows relevance)
- No immediate ask (warm connection first)

---

## Slack/Discord DM Template

For reaching out in public communities (React, Next.js, QA communities):

```
Hey [First Name], saw your question about [specific topic, e.g., "visual regression testing"]  
in #general. We just launched an open-source tool for this—runs in GitHub Actions,  
takes 5 min to set up. Happy to share if you're interested! (No spam, promise 😊)
```

**Why this works:**
- References their specific question (not generic spam)
- Offers value, doesn't demand response
- Lighthearted tone (fits community culture)

---

## Cold Call Script (If Applicable)

**Note:** Cold calling is rare for dev tools, but if you get a phone number:

---

**Introduction (15 seconds):**
```
Hi [First Name], this is [Your Name] from AI Gatekeeper. I know you're busy,  
so I'll be quick—is now an okay time for 60 seconds?

[If yes, continue. If no, ask when's better.]
```

**Pitch (30 seconds):**
```
We built an open-source tool that catches visual bugs in your PRs before they merge.  
It's like Percy or Chromatic, but self-hosted and free. Runs in GitHub Actions,  
takes 5 minutes to set up.

I saw [Company] uses [tech stack]. Would it help if I sent over a Next.js template  
you could test in 10 minutes? No sales pitch, just the repo link.
```

**Close (15 seconds):**
```
What's the best way to send that over—email or Slack?

[Get email/Slack handle, thank them, hang up.]
```

**Total duration:** 60 seconds (respectful of their time)

---

## Success Stories to Reference

Once you have early adopters, add to outreach:

**Example:**
```
"[Company X] set this up last week and caught 3 regressions in their first 10 PRs.  
Their QA lead said it saved them 4 hours of manual testing per release."
```

**Where to collect:**
- GitHub Discussions (ask for feedback)
- Post-demo surveys ("Would you recommend this to a colleague?")
- LinkedIn testimonials (ask happy users to endorse)

---

## A/B Test Variants

Test subject lines:

**Variant A (Current):**
```
Catch UI bugs in your PRs (5-min setup, zero cost)
```

**Variant B (Pain-focused):**
```
Stop shipping broken UIs to production
```

**Variant C (Competitive):**
```
Percy alternative: $0/month, unlimited screenshots
```

**Variant D (Curiosity):**
```
How [Company X] eliminated visual regressions
```

**Success metric:** Open rate >25% for cold emails

---

## Post-Send Checklist

Before hitting send:
- ✅ Recipient name spelled correctly
- ✅ Company name correct (not competitor)
- ✅ Links work (template repo, video demo)
- ✅ No typos or grammar errors (use Grammarly)
- ✅ Mobile-friendly (if email, test on phone)
- ✅ Unsubscribe link included (if mass email)
- ✅ Tracking link added (UTM parameters for analytics)

---

## Tracking Template

Track outreach in a spreadsheet:

| Name | Company | Title | Channel | Date Sent | Response? | Demo Booked? | Outcome | Notes |
|------|---------|-------|---------|-----------|-----------|--------------|---------|-------|
| Jane Doe | Acme Inc | VP Eng | Email | 2026-01-04 | Yes | Yes | Deployed | Loved setup speed |
| John Smith | Beta Co | QA Lead | LinkedIn | 2026-01-05 | No | - | - | Follow up 1/12 |

**Why this matters:**
- Prevents duplicate outreach
- Tracks response rates per channel
- Identifies best-performing messages
- Builds case study pipeline

---

## Legal/Compliance Notes

### CAN-SPAM Compliance (US)
- ✅ Include physical mailing address in footer
- ✅ Include unsubscribe link (if mass email)
- ✅ Honor unsubscribe requests within 10 days
- ✅ Don't use misleading subject lines

### GDPR Compliance (EU)
- ✅ Only email if you have legitimate interest (B2B = usually okay)
- ✅ Include privacy policy link
- ✅ Allow recipients to request data deletion
- ✅ Don't share email lists with third parties

### LinkedIn Rules
- ✅ Don't send mass InMails (LinkedIn will throttle/ban)
- ✅ Personalize every message (no copy-paste)
- ✅ Don't scrape emails from profiles (use LinkedIn's messaging)

---

## Next Steps After Positive Response

**If they reply "interested":**
1. Send template link + 90-second video immediately
2. Offer 15-min screen share for Q&A
3. Add to Slack/Discord community (if exists)
4. Follow up in 3 days if no further response

**If they book demo:**
1. Send calendar invite with Zoom link
2. Attach pre-demo email with repo link (so they can prep)
3. During demo:
   - Show live setup (5 min)
   - Run on their app (if possible)
   - Address objections
   - Get feedback on roadmap
4. Post-demo: Send thank-you email + ask for testimonial/referral

**If they deploy:**
1. Request case study interview (15 min)
2. Ask for GitHub star (social proof)
3. Request testimonial for landing page
4. Ask for referrals ("Know anyone else who'd benefit?")

---

## Templates for Next Steps

### Pre-Demo Email

**Subject:** "AI Gatekeeper demo prep — [Date/Time]"

```
Hi [First Name],

Looking forward to our demo on [Date] at [Time]!

To make the most of our 15 minutes, here's the repo:
[Template link]

If you want to try the setup beforehand (totally optional), it's:
1. Clone the repo
2. Run `npm install && npm run test:visual`
3. Check `.ai-gate/evidence/` for diff images

See you [Day]!

[Your Name]
```

---

### Post-Demo Thank You

**Subject:** "Thanks for the demo — AI Gatekeeper next steps"

```
Hi [First Name],

Thanks for taking the time to chat today! Recap of what we covered:

✅ You're interested in testing on [specific app/feature]
✅ Main concern: [e.g., "handling dynamic timestamps"]
✅ Next step: [e.g., "Set up masks for timestamp selectors"]

Here's the template again: [Template link]

And our Discord for quick questions: [Discord link]

Let me know how the setup goes—happy to hop on Slack/email if you hit any snags.

Also, if this ends up working well for [Company], would you be open to a quick  
testimonial or case study? (5 min interview, we'll write it up.)

Thanks again!

[Your Name]
```

---

### Request for Testimonial

**Subject:** "Quick favor — AI Gatekeeper testimonial?"

```
Hi [First Name],

Hope AI Gatekeeper is working well for [Company]!

Quick ask: Would you be willing to provide a 1-2 sentence testimonial we can  
feature on our landing page?

Something like:
"AI Gatekeeper caught [X] bugs in our first week. Setup took [Y] minutes.  
Highly recommend for teams using [tech stack]."

Totally understand if you're not comfortable with this—no worries either way.

If yes, I'll send it to you for approval before publishing.

Thanks!

[Your Name]
```

---

### Request for Referral

**Subject:** "Know anyone who'd benefit from AI Gatekeeper?"

```
Hi [First Name],

Glad to hear AI Gatekeeper is working out for [Company]!

Quick question: Do you know anyone else (eng leads, QA managers) who might benefit?

We're looking for early feedback and happy to do white-glove setup for referrals.

If you send an intro, I'll make sure they get prioritized support.

Thanks!

[Your Name]
```

---

## Final Notes

**Golden rules for outreach:**
1. **Personalize every message** (no spray-and-pray)
2. **Lead with value** (template, demo, ROI calc)
3. **Keep it short** (<150 words for cold emails)
4. **One clear CTA** (don't offer 5 options)
5. **Follow up exactly once** (don't spam)

**What NOT to do:**
- ❌ Send to generic info@ emails (low response rate)
- ❌ Pitch in Twitter/LinkedIn comments (spammy)
- ❌ Use automated LinkedIn bots (violates ToS)
- ❌ Overpromise ("this will solve all your problems")
- ❌ Trash competitors ("Percy sucks, use us instead")

**Mindset:**
You're offering free value (open-source tool), not selling a $10k/year SaaS contract.  
Position as **peer-to-peer collaboration**, not vendor-customer transaction.

Good luck! 🚀
