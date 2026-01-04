# AI Gatekeeper: 90-Second Demo Script

**Audience:** Engineering leads, QA managers, developers evaluating visual regression testing tools  
**Format:** Screen recording with voiceover  
**Duration:** 90 seconds  
**Goal:** Show complete PR workflow from visual regression → detection → evidence → resolution

---

## Setup Requirements

Before recording:
- Have repository with AI Gatekeeper template cloned
- Working baseline images already committed
- GitHub Actions workflow configured
- PR ready to create with visual regression (button text change)

---

## Script Timeline

### [0:00-0:10] Introduction (10 seconds)

**Screen:** GitHub repository main page  
**Narration:**  
> "This is AI Gatekeeper—automated visual regression testing for your PRs. Watch how it catches UI changes in 90 seconds."

**Actions:**
- Show repository name: `ai-gate-template-nextjs`
- Show README with CI badge (green)

---

### [0:10-0:25] Create Breaking PR (15 seconds)

**Screen:** GitHub PR creation page  
**Narration:**  
> "I'm opening a PR that changes a button label from 'Sign in' to 'Log In Now'. Let's see what happens."

**Actions:**
1. Click **Pull requests** tab
2. Click **New pull request**
3. Show branch name: `change-login-button`
4. PR title visible: `Update login button text`
5. Click **Create pull request** button
6. Show PR #1 created

**Timing notes:**
- Fast-forward through typing if needed
- Focus on the visual change in the diff: `"Sign in"` → `"Log In Now"`

---

### [0:25-0:40] CI Runs and Fails (15 seconds)

**Screen:** GitHub PR page showing checks  
**Narration:**  
> "Within seconds, the AI Gatekeeper workflow detects a visual difference and fails the check."

**Actions:**
1. Show **Checks** tab automatically selected
2. Show status: `AI Gatekeeper / visual-regression` ❌ **Failed**
3. Scroll to workflow summary showing:
   ```
   ✓ login passed
   ✗ pricing failed: Visual differences detected
   ```
   _(Note: For demo purposes, assume the change affects the login page, not pricing. Adjust accordingly.)_
4. Show exit code: `1`

**Timing notes:**
- If recording live, speed up video 2x during wait
- Or use pre-recorded run and jump to failure state

---

### [0:40-0:55] View Artifacts (15 seconds)

**Screen:** GitHub Actions workflow run page  
**Narration:**  
> "Click on the artifacts to see exactly what changed."

**Actions:**
1. Click **Details** next to failed check
2. Scroll down to **Artifacts** section
3. Show artifact: `ai-gate-evidence` (uploaded 12 seconds ago)
4. Click **ai-gate-evidence** to download
5. Extract ZIP file
6. Open folder structure:
   ```
   ai-gate-evidence/
   └── login/
       ├── baseline.png
       ├── current.png
       └── diff.png
   ```

**Timing notes:**
- Use split-screen or picture-in-picture to show download + extraction simultaneously
- Optionally speed up extraction to 1.5x

---

### [0:55-1:15] Compare Images (20 seconds)

**Screen:** Image viewer showing three images side-by-side  
**Narration:**  
> "Here's the baseline with 'Sign in', the current screenshot with 'Log In Now', and the diff highlighting the exact change."

**Actions:**
1. Open `baseline.png` (left): Button shows "Sign in"
2. Open `current.png` (middle): Button shows "Log In Now"
3. Open `diff.png` (right): Red highlight around button area
4. Zoom in on button region to show clear visual diff
5. Pause for 3 seconds to let viewer absorb

**Timing notes:**
- Use image viewer that supports grid layout (macOS Preview, Windows Photos, ImageMagick, etc.)
- Ensure diff highlights are clearly visible (use high-contrast diff)

---

### [1:15-1:25] Resolution (10 seconds)

**Screen:** GitHub PR page  
**Narration:**  
> "Now we can either update the baseline or revert the change. Either way, no surprise UI breaks make it to production."

**Actions:**
1. Return to PR page
2. Show two options in description or comment:
   - Option 1: "Approve change → Update baseline"
   - Option 2: "Reject change → Revert commit"
3. Show PR status still ❌ **Failed** (blocking merge)

**Timing notes:**
- Don't actually merge or close the PR
- Just show that PR is blocked

---

### [1:25-1:30] Call to Action (5 seconds)

**Screen:** Terminal showing template clone command OR GitHub template page  
**Narration:**  
> "Get started in 5 minutes. Clone the template, run npm install, and you're live."

**Actions:**
1. Show command:
   ```bash
   git clone https://github.com/your-org/ai-gate-template-nextjs
   cd ai-gate-template-nextjs
   npm ci && npm run test:visual
   ```
   OR show "Use this template" button on GitHub
2. Show URL overlay: `github.com/your-org/ai-gate-template-nextjs`

---

## Production Notes

### Recording Tips
- **Resolution:** 1920x1080 (1080p) for clarity
- **Frame rate:** 30 fps minimum
- **Cursor:** Use cursor highlighting (macOS: Cmd+Shift+5 → Options → Show Mouse Clicks)
- **Transitions:** Use quick cuts between sections (no fade effects)
- **Speed:** Use 1.5-2x speed-up during wait times (CI run, file download)

### Voiceover Recording
- **Tone:** Professional but approachable, confident
- **Pacing:** Speak slightly slower than normal conversation
- **Emphasis:** Stress "90 seconds", "exact change", "5 minutes"
- **Equipment:** Use external microphone (avoid laptop mic)
- **Environment:** Quiet room, no background noise

### Visual Enhancements
- **Annotations:** Use arrows or circles to highlight:
  - Failed check status ❌
  - Artifact download link
  - Diff highlight region
- **Zoom:** Zoom in 150% on button text differences
- **Overlay text:** Add timestamps or step numbers in corner (optional)

### Accessibility
- **Captions:** Add closed captions for all narration
- **Contrast:** Ensure diff images have >4.5:1 contrast ratio
- **Font size:** If showing code/commands, use minimum 16pt font

---

## Alternative 60-Second Version

If 90 seconds is too long, condense to 60 seconds:

| Time | Section | Duration |
|------|---------|----------|
| 0:00-0:07 | Introduction | 7s |
| 0:07-0:17 | Create PR with visual change | 10s |
| 0:17-0:27 | CI fails | 10s |
| 0:27-0:37 | Download artifacts | 10s |
| 0:37-0:52 | View diff images | 15s |
| 0:52-0:60 | CTA | 8s |

**Cuts to make:**
- Skip showing PR creation UI (just show final PR page)
- Skip ZIP extraction (jump straight to opened images)
- Reduce pause time on diff comparison

---

## Post-Production Checklist

Before publishing:
- ✅ Video is exactly 90 seconds (±3 seconds acceptable)
- ✅ All URLs/repo names are correct (no placeholder text)
- ✅ Diff images are clearly visible at 1080p
- ✅ Voiceover audio is clear with no clipping
- ✅ Captions are synced and accurate
- ✅ Annotations are not obtrusive
- ✅ CTA is clear and actionable
- ✅ Video plays smoothly at 1x speed (no jerky transitions)
- ✅ Export format: MP4 (H.264, AAC audio)
- ✅ File size: <50MB for easy sharing

---

## Distribution Channels

Upload to:
- **YouTube:** Unlisted or public (add to playlist "AI Gatekeeper Demos")
- **GitHub README:** Embed at top of main repository
- **Landing page:** Hero section video player
- **Social media:** Twitter/LinkedIn (with captions)
- **Documentation site:** Tutorial section

---

## Variations

Create 3 versions:

1. **90-second detailed** (this script) - for landing page
2. **60-second condensed** - for social media
3. **30-second teaser** - for ads
   - Show: PR creation (5s) → CI fail (5s) → Diff image (15s) → CTA (5s)
   - Narration: "AI Gatekeeper catches visual bugs before they reach production. 5-minute setup. Try it now."

---

## Example Narration Script (Full Text)

> [0:00] "This is AI Gatekeeper—automated visual regression testing for your PRs. Watch how it catches UI changes in 90 seconds."
>
> [0:10] "I'm opening a PR that changes a button label from 'Sign in' to 'Log In Now'. Let's see what happens."
>
> [0:25] "Within seconds, the AI Gatekeeper workflow detects a visual difference and fails the check."
>
> [0:40] "Click on the artifacts to see exactly what changed."
>
> [0:55] "Here's the baseline with 'Sign in', the current screenshot with 'Log In Now', and the diff highlighting the exact change."
>
> [1:15] "Now we can either update the baseline or revert the change. Either way, no surprise UI breaks make it to production."
>
> [1:25] "Get started in 5 minutes. Clone the template, run npm install, and you're live."

**Total word count:** 112 words  
**Speaking pace:** ~75 words per minute (comfortable, not rushed)

---

## Troubleshooting

**Issue:** CI check takes too long to fail (>30 seconds)  
**Solution:** Speed up video 2x during wait, or use pre-recorded run

**Issue:** Diff image not visible in recording  
**Solution:** Increase diff highlight color saturation, use 150% zoom

**Issue:** Artifacts section not visible without scrolling  
**Solution:** Use smaller browser window height, or edit out scrolling in post

**Issue:** Narration doesn't fit in 90 seconds  
**Solution:** Speak slightly faster (80 WPM) or cut filler words ("now", "here")

---

## Success Metrics

After publishing, track:
- **View completion rate:** Target >60% watch 90% of video
- **Click-through rate:** From video → template repository (target >5%)
- **Social shares:** Track retweets/LinkedIn shares
- **Feedback:** Monitor comments for confusion points

If completion rate <50%, consider creating 60-second version and A/B testing.
