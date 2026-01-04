# Customer Acceptance Checklist

This document defines explicit pass/fail criteria for validating AI Gatekeeper in real-world customer scenarios.

## ✅ Pass/Fail Criteria

### 1. PR Comment Updates (No Spam)
**Requirement**: Single comment that updates in place; no duplicate comments.

**Pass Criteria**:
- [ ] First run creates a new PR comment with the marker `<!-- ai-gatekeeper-summary -->`
- [ ] Subsequent runs update the same comment (no new comments created)
- [ ] Comment includes: run status, total/passed/failed counts, worst similarity
- [ ] Comment includes artifact download instructions

**Fail Criteria**:
- ❌ Multiple comments created for the same PR
- ❌ Comment spam on every push
- ❌ Missing artifact download instructions

**Test Procedure**:
1. Create PR with baseline changes
2. Push commit #1, verify comment created
3. Push commit #2, verify same comment updated (check comment ID)
4. Verify only one AI Gatekeeper comment exists

---

### 2. Fork PR Permission Behavior (Graceful Fallback)
**Requirement**: No workflow failures when PR is from fork; graceful degradation.

**Pass Criteria**:
- [ ] Fork PR runs complete successfully (exit code 0 if tests pass)
- [ ] Console shows clear warning: "Unable to post PR comment"
- [ ] Console shows reason: "PR may be from a fork or workflow lacks comment permissions"
- [ ] Console shows fallback: "Check Artifacts for evidence"
- [ ] Evidence is still uploaded to GitHub Artifacts
- [ ] No scary error stack traces in logs

**Fail Criteria**:
- ❌ Workflow fails due to permission error
- ❌ Confusing error messages
- ❌ No guidance on where to find results

**Test Procedure**:
1. Create fork of repository
2. Make change in fork and open PR to main repo
3. Verify workflow runs without failure
4. Verify console shows helpful fork message
5. Verify artifacts are uploaded

---

### 3. Artifact Download Path
**Requirement**: Evidence artifacts are easy to find and download.

**Pass Criteria**:
- [ ] Artifact name is `ai-gate-evidence`
- [ ] Artifact path is `.ai-gate/evidence/` 
- [ ] Artifact contains: `index.html`, `report.html`, `actual/`, `diff/`, `summary.json`
- [ ] Download instructions in PR comment are accurate
- [ ] Artifact retention is 30 days (configurable in workflow)

**Fail Criteria**:
- ❌ Artifact not uploaded
- ❌ Artifact missing critical files
- ❌ Incorrect artifact name or path

**Test Procedure**:
1. Run gate in GitHub Actions
2. Go to Actions → Workflow run → Artifacts
3. Download `ai-gate-evidence` artifact
4. Unzip and verify all files present
5. Verify paths match documentation

---

### 4. Offline index.html Rendering (No External Assets)
**Requirement**: Downloaded evidence must work offline with no internet connection.

**Pass Criteria**:
- [ ] `index.html` opens in browser without internet
- [ ] All images load correctly
- [ ] All CSS is inline (no external stylesheets)
- [ ] No broken image links
- [ ] No external CDN dependencies
- [ ] All file references use relative paths

**Fail Criteria**:
- ❌ Images fail to load offline
- ❌ External CSS/JS dependencies
- ❌ Broken links to missing files
- ❌ Absolute paths that don't resolve

**Test Procedure**:
1. Download artifact zip
2. Extract to local folder
3. Disable internet connection
4. Open `index.html` in browser
5. Verify all images render
6. Verify no console errors for missing resources

**Automated Check**:
```bash
# Parse HTML and verify no external URLs
grep -E 'https?://' index.html && exit 1
# Verify all referenced images exist
# (See E2E test in section below)
```

---

### 5. Evidence Completeness (Baseline/Current/Diff Exist)
**Requirement**: All evidence files must be present for failed screens.

**Pass Criteria**:
- [ ] For each failed screen: baseline image, actual image, diff image exist
- [ ] For each passed screen: actual image exists
- [ ] `summary.json` contains complete comparison data
- [ ] `report.html` correctly references all images
- [ ] No orphaned references to missing files

**Fail Criteria**:
- ❌ Missing baseline, actual, or diff images
- ❌ Broken image references in HTML
- ❌ Incomplete summary.json

**Test Procedure**:
1. Run gate with at least one failing screen
2. Check evidence folder structure:
   ```
   .ai-gate/evidence/
   ├── index.html
   ├── report.html
   ├── summary.json
   ├── actual/
   │   └── screen-name.png
   ├── diff/
   │   └── screen-name.png
   └── baselines/
       └── screen-name.png
   ```
3. Open report.html and verify all images load
4. Verify summary.json has all comparison results

---

### 6. Large-Run Behavior (≥50 Screens)
**Requirement**: System must handle large runs without degradation.

**Pass Criteria**:
- [ ] Runs with 50+ screens complete successfully
- [ ] All 50+ screens appear in HTML report
- [ ] HTML report loads in browser without freezing
- [ ] Artifact upload completes (< 500MB recommended)
- [ ] PR comment shows accurate counts for all screens
- [ ] No timeout errors in GitHub Actions

**Fail Criteria**:
- ❌ Out of memory errors
- ❌ Artifact upload timeout
- ❌ HTML report too large to load in browser
- ❌ Missing screens in report

**Test Procedure**:
1. Configure gate with 50+ screens
2. Run gate in GitHub Actions
3. Verify workflow completes within timeout (default 30min)
4. Download artifact and verify size is reasonable
5. Open report.html and verify all screens present
6. Check PR comment for accurate counts

**Performance Targets**:
- Run time: < 30 minutes for 50 screens
- Artifact size: < 500MB for 50 screens
- Report load time: < 5 seconds in browser

---

## 🧪 Automated E2E Checks

The following checks are automated in the test suite:

### Offline Report Correctness Check
```typescript
// packages/cli/src/commands/gate.test.ts
test('gate run produces offline-compatible report', async () => {
  // Run gate
  await gate.run();
  
  // Verify index.html exists
  const indexPath = '.ai-gate/evidence/index.html';
  expect(fs.existsSync(indexPath)).toBe(true);
  
  // Parse HTML and verify no external URLs
  const html = fs.readFileSync(indexPath, 'utf-8');
  const externalUrlPattern = /https?:\/\//g;
  const externalUrls = html.match(externalUrlPattern) || [];
  expect(externalUrls.length).toBe(0);
  
  // Extract image references
  const imgPattern = /src="([^"]+)"/g;
  const images = [...html.matchAll(imgPattern)].map(m => m[1]);
  
  // Verify all referenced images exist
  for (const img of images) {
    const imgPath = path.join('.ai-gate/evidence', img);
    expect(fs.existsSync(imgPath)).toBe(true);
  }
});
```

### Evidence Completeness Check
```typescript
test('gate run includes all required evidence files', async () => {
  const result = await gate.run();
  
  const evidenceDir = '.ai-gate/evidence';
  
  // Required files
  expect(fs.existsSync(path.join(evidenceDir, 'index.html'))).toBe(true);
  expect(fs.existsSync(path.join(evidenceDir, 'report.html'))).toBe(true);
  expect(fs.existsSync(path.join(evidenceDir, 'summary.json'))).toBe(true);
  
  // For each failed screen, verify baseline/actual/diff exist
  const summary = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'summary.json'), 'utf-8'));
  for (const comparison of summary.comparisons) {
    if (!comparison.passed) {
      expect(fs.existsSync(comparison.baselinePath)).toBe(true);
      expect(fs.existsSync(comparison.actualPath)).toBe(true);
      expect(fs.existsSync(comparison.diffPath)).toBe(true);
    }
  }
});
```

---

## 📋 Pre-Release Checklist

Before releasing to customers, verify:

- [ ] All 6 pass/fail criteria validated
- [ ] Automated E2E tests passing
- [ ] Documentation includes 2-click layman flow
- [ ] GitHub Actions workflow template updated with permissions
- [ ] Review pack zip generator tested
- [ ] Large-run performance tested (50+ screens)
- [ ] Fork PR scenario tested
- [ ] Offline report tested in 3+ browsers (Chrome, Firefox, Safari)

---

## 🎯 Customer Success Metrics

Track these metrics for ongoing validation:

1. **Fork PR Success Rate**: % of fork PRs that complete without errors
2. **Artifact Download Rate**: % of users who successfully download artifacts
3. **Offline Report Success**: % of reports that work offline
4. **Large Run Success**: % of 50+ screen runs that complete
5. **Comment Spam Rate**: Average number of comments per PR (target: 1)

---

## 🚨 Known Limitations

Document known limitations to set customer expectations:

1. **Fork PRs**: Cannot post comments due to GitHub security model
2. **Artifact Size**: Recommend < 500MB for reasonable download times
3. **Browser Compatibility**: HTML reports tested in Chrome, Firefox, Safari
4. **Retention**: Artifacts kept for 30 days (configurable)

---

## 📞 Support Escalation

If any criterion fails in customer environment:

1. Collect GitHub Actions logs
2. Download and inspect artifact contents
3. Check workflow permissions configuration
4. Verify AI Gatekeeper version matches docs
5. Open issue with reproduction steps
