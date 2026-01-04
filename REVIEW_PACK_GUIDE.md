# Review Pack Guide

The **AI Gatekeeper Review Pack** is a self-contained ZIP file designed for non-technical reviewers to easily review visual regression test results.

## What is a Review Pack?

A review pack is a single downloadable file that contains everything needed to review visual changes:

- **index.html** - Interactive visual report (just open in browser)
- **report.html** - Detailed technical report
- **summary.json** - Machine-readable test results
- **baselines/** - Expected baseline screenshots
- **actual/** - Current screenshots from this run
- **diff/** - Visual differences highlighted
- **README.md** - Instructions for reviewers

## Why Use Review Packs?

### For Reviewers (Non-Technical)
✅ **One file to download** - No need to download multiple artifacts  
✅ **Works 100% offline** - No internet connection required  
✅ **No technical knowledge needed** - Just open index.html  
✅ **Visual comparison** - See exactly what changed side-by-side  

### For Teams
✅ **Easy to share** - Email, Slack, or any file sharing  
✅ **Consistent experience** - Everyone sees the same thing  
✅ **Archivable** - Keep historical visual test results  
✅ **Transparent** - All evidence in one place  

## Creating a Review Pack

### Option 1: Automatic (GitHub Actions)

The review pack is automatically created when you run AI Gatekeeper in GitHub Actions:

```yaml
- name: Run AI Gatekeeper
  run: npx ai-gate run --baseURL http://localhost:3000

- name: Create review pack
  if: always()
  run: npx ai-gate review-pack

- name: Upload review pack
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: ai-gate-review-pack
    path: ai-gate-review-pack.zip
```

### Option 2: Manual (CLI)

You can create a review pack manually after running tests:

```bash
# Run gate first
pnpm ai-gate run --baseURL http://localhost:3000

# Create review pack from latest run
pnpm ai-gate review-pack

# Or create from specific run
pnpm ai-gate review-pack --runId run-1234567890

# Custom output location
pnpm ai-gate review-pack --out ./my-review.zip

# Custom baselines directory
pnpm ai-gate review-pack --baselines ./my-baselines
```

## How to Download from GitHub

### For PR Reviewers

1. **Go to the PR** you're reviewing
2. **Click "Checks"** tab at the top
3. **Click the workflow** (e.g., "AI Gatekeeper")
4. **Scroll to "Artifacts"** at the bottom
5. **Click "ai-gate-review-pack"** to download

### For Direct Workflow Access

1. **Go to "Actions"** tab
2. **Click the workflow run**
3. **Scroll to "Artifacts"**
4. **Download "ai-gate-review-pack"**

## How to Review the Pack

### Step 1: Unzip
Extract `ai-gate-review-pack.zip` to any folder on your computer.

### Step 2: Open index.html
Double-click `index.html` to open it in your web browser.

### Step 3: Review Changes
The report shows:
- ✅ **Green screens**: No visual changes
- ❌ **Red screens**: Visual changes detected

For each failed screen, you'll see:
- **Baseline (Expected)**: What the screen should look like
- **Current (Actual)**: What the screen looks like now
- **Difference (Highlighted)**: Visual changes highlighted in pink

### Step 4: Make Decision
Ask yourself:
- Are these changes **intentional**? (New feature, design update)
- Or are they **regressions**? (Bugs, unintended changes)

## Review Pack vs Evidence Pack

| Feature | Review Pack | Evidence Pack |
|---------|-------------|---------------|
| **Audience** | Non-technical reviewers | Technical teams |
| **index.html** | ✅ Interactive visual report | ❌ Not included |
| **Baseline images** | ✅ Included | ❌ Not included |
| **Works offline** | ✅ Yes | ✅ Yes |
| **README.md** | ✅ Included | ❌ Not included |
| **Size** | Larger (includes baselines) | Smaller |
| **Use case** | PR review, stakeholder review | CI/CD artifacts, debugging |

**Rule of thumb**: Use **review pack** for humans, **evidence pack** for automation.

## Example Workflow

### For Same-Repo PRs (Comment Works)

1. Developer opens PR
2. AI Gatekeeper runs automatically
3. PR comment shows summary
4. If changes detected, reviewer downloads review pack
5. Reviewer opens index.html and reviews visually
6. Reviewer approves or requests changes

### For Fork PRs (Comment Doesn't Work)

1. External contributor opens PR from fork
2. AI Gatekeeper runs (cannot post comment)
3. Console shows: "Check Artifacts for evidence"
4. Reviewer goes to Actions → Downloads review pack
5. Reviewer opens index.html and reviews visually
6. Reviewer comments manually with findings

## Advanced Usage

### Including Custom Baselines

```bash
pnpm ai-gate review-pack --baselines ./custom-baselines
```

### Packaging Multiple Runs

```bash
# Create pack for run 1
pnpm ai-gate review-pack --runId run-001 --out pack-001.zip

# Create pack for run 2
pnpm ai-gate review-pack --runId run-002 --out pack-002.zip
```

### Archiving for Compliance

Review packs can be archived for audit trails:

```bash
# Create timestamped archive
pnpm ai-gate review-pack --out "review-$(date +%Y%m%d-%H%M%S).zip"

# Upload to S3
aws s3 cp ai-gate-review-pack.zip s3://my-bucket/reviews/
```

## Troubleshooting

### "Summary file not found"
You need to run `pnpm ai-gate run` first before creating a review pack.

### "Images not loading in browser"
Make sure you extracted the entire ZIP file. The images must be in the same folder structure.

### "External URL errors"
The review pack should be 100% offline. If you see external URL errors, file a bug report.

### Large file size
Review packs include baseline images. For 50+ screens, expect 100-500MB ZIP files.

## Security Considerations

### What's Included
- Screenshots (may contain sensitive UI data)
- Test metadata (URLs, timestamps)
- Git information (commit SHA, branch)

### What's NOT Included
- Source code
- API keys or secrets
- Database data
- Authentication tokens

### Best Practices
✅ Review packs are safe to share with internal teams  
✅ Be cautious sharing externally (screenshots may show sensitive UI)  
⚠️ Don't commit review packs to Git (they're large binary files)  
⚠️ Set appropriate artifact retention (default: 30 days)  

## FAQ

**Q: Can I open the review pack on mobile?**  
A: Yes, but desktop browsers provide a better experience for side-by-side comparisons.

**Q: Do I need to install anything?**  
A: No, just a web browser (Chrome, Firefox, Safari, Edge all work).

**Q: Can I share the review pack via email?**  
A: Yes, but file size limits may apply. Consider using file sharing services for large packs.

**Q: How long are review packs kept on GitHub?**  
A: Default is 30 days, configurable in your workflow file.

**Q: Can I customize the report styling?**  
A: The HTML is generated with inline CSS. You can modify the template in `packages/core/src/evidence.ts`.

**Q: Does this work with other CI systems (not GitHub Actions)?**  
A: Yes! The `ai-gate review-pack` command works anywhere. Just upload the ZIP file using your CI's artifact system.

## Related Documentation

- [Customer Acceptance Checklist](./CUSTOMER_ACCEPTANCE_CHECKLIST.md) - Validation criteria
- [GitHub Actions Setup](./docs/github-actions/ai-gate.yml) - Workflow configuration
- [2-Click Layman Flow](./README.md#2-click-layman-flow) - Quick review guide
