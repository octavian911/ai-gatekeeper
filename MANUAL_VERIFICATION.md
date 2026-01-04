# Manual Verification Guide

After deploying the stabilization sprint changes, follow these steps to verify everything works correctly.

---

## ✅ 1. Export ZIP Verification

### Export Flow Architecture

The export system delivers real binary ZIP files using object storage:

1. **Backend**: Generates ZIP in-memory → uploads to object storage bucket → returns signed download URL (10min TTL)
2. **Frontend**: Receives download URL → triggers browser navigation → binary ZIP downloads
3. **Cleanup**: Cron job runs every 10 minutes, deletes exports older than 15 minutes

### Test: Export Download Works
```bash
# In browser:
1. Navigate to Baselines page
2. Click "Export ZIP" button
3. Verify download starts immediately
4. Open downloaded ZIP
5. Verify structure:
   baselines/
     manifest.json
     <screenId>/baseline.png
     <screenId>/screen.json (if exists)
   .gate/policy.json (if exists)
   README.txt
```

**Expected:** 
- Download starts immediately (no base64 decode delay)
- ZIP structure correct
- File size is reasonable (no base64 inflation)

### Test: Copy Export Link
```bash
# In browser:
1. Click "Copy link" button (link icon)
2. Toast message shows expiration time
3. Paste URL in new browser tab
4. Verify binary ZIP downloads directly
```

**Expected:** 
- Signed URL copied to clipboard
- Toast shows: "Download link copied... (expires at HH:MM:SS)"
- Direct paste in new tab downloads ZIP (no JSON wrapper)
- Link expires after 10 minutes (404 or error)

### Test: Network Tab Validation
```bash
# In browser DevTools:
1. Open Network tab
2. Click "Export ZIP"
3. Find first request to /baselines/export.zip
   - Expected response: JSON with {downloadUrl, filename, expiresAt}
4. Find second request to signed download URL
   - Expected Content-Type: application/zip
   - Expected Content-Disposition: attachment
   - Expected body: binary ZIP bytes (starts with 0x504B)
```

**Expected:**
- API returns JSON metadata (not binary)
- downloadUrl is a signed URL (e.g., AWS S3, GCS, or similar)
- Signed URL returns Content-Type: application/zip
- No base64 encoding visible in Network tab

### Test: Signed URL Binary Export Security
```bash
# Verify signed URL forces download and contains correct content
curl -I "$(curl -s https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev/baselines/export.zip | jq -r '.downloadUrl')"

# Expected headers:
HTTP/2 200
content-type: application/zip
content-disposition: attachment; filename="baselines-export-20260104-1425.zip"
content-length: <positive number>

# Example output showing Content-Disposition:
# HTTP/2 200 
# content-type: application/zip
# content-disposition: attachment; filename="baselines-export-20260104-1425.zip"
# content-length: 12345
# etag: "abc123..."
# last-modified: Sat, 04 Jan 2026 14:25:30 GMT

# Download and verify ZIP structure
curl -s "$(curl -s https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev/baselines/export.zip | jq -r '.downloadUrl')" -o /tmp/test-export.zip

# Verify ZIP is valid
unzip -l /tmp/test-export.zip

# Expected entries:
baselines/manifest.json
baselines/<screenId>/baseline.png (at least 1 image file)
baselines/<screenId>/screen.json (optional)
.gate/policy.json (optional)
README.txt

# Verify manifest.json exists and is valid JSON
unzip -p /tmp/test-export.zip baselines/manifest.json | jq .

# Expected: Valid JSON with baselines array
{
  "baselines": [...]
}

# Verify object key includes repoId/exportId pattern
# Object keys should follow pattern: <repoId>/<uuid>.zip
# This prevents collisions across repositories
```

**Expected Security Properties:**
- ✅ Content-Type: application/zip preserved
- ✅ Content-Disposition: attachment; filename="baselines-export-YYYYMMDD-HHMM.zip"
- ✅ Content-Length > 0
- ✅ ZIP file opens successfully
- ✅ baselines/manifest.json exists at expected path
- ✅ At least 1 baseline image file present
- ✅ Object key includes repoId prefix (visible in signed URL path)
- ✅ Bucket is private (signed URL required, not publicly accessible)
- ✅ Signed URL expires after 10 minutes (test by waiting or checking expiresAt)

### Test: Large Export Performance
```bash
# In browser:
1. Apply filter: "all" (no filter)
2. Ensure 10+ baselines exist
3. Click "Export ZIP"
4. Measure time from click to download start
```

**Expected:**
- Download starts within 3-5 seconds (regardless of ZIP size)
- No browser lag or freeze
- Memory usage stays reasonable (no large base64 strings in memory)

---

## ✅ 2. Manifest Recovery Verification

### Test: Corrupt and Recover
```bash
# Terminal:
cd /baselines

# Backup current manifest
cp manifest.json manifest.safe.json

# Corrupt manifest
echo "corrupted" > manifest.json

# Try CLI recovery
pnpm gate manifest:recover

# Verify
cat manifest.json | jq .
```

**Expected:** 
- ✅ Recovery succeeds
- ✅ Manifest restored from backup
- ✅ Baselines count matches original

### Test: Validate Manifest
```bash
# Terminal:
pnpm gate manifest:validate
```

**Expected:** 
- ✅ Validation passes
- ✅ Shows baseline count

### Test: API Recovery
```bash
# In browser console (while on Baselines page):
fetch('/baselines/recover-manifest', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

**Expected:** `{ "recovered": false, "message": "Manifest is valid. No recovery needed." }`

---

## ✅ 3. Mask Validation Verification

### Test: Invalid CSS Mask
```bash
# In browser:
1. Click "View" on any baseline
2. Click "Edit" (if available) or "Add Mask"
3. Add CSS mask with empty selector: ""
4. Click "Save"
```

**Expected:** 
- ❌ Save fails
- ❌ Error message: "CSS selector cannot be empty"

### Test: Invalid Rect Mask
```bash
# In browser:
1. Add Rectangle mask
2. Set width = -10
3. Click "Save"
```

**Expected:**
- ❌ Save fails
- ❌ Error message: "width must be > 0"

### Test: Valid Masks
```bash
# In browser:
1. Add CSS mask: "input[name='timestamp']"
2. Add Rect mask: x=10, y=10, width=100, height=50
3. Click "Save"
```

**Expected:**
- ✅ Save succeeds
- ✅ Masks persist after page reload

---

## ✅ 4. Bulk Upload Safety Verification

### Test: Upload 25 Files (Max)
```bash
# Prepare 25 test images (or use script)
for i in {1..25}; do
  cp test-image.png test-$i.png
done

# In browser:
1. Click "Upload Images"
2. Select all 25 files
3. Click "Upload"
```

**Expected:**
- ✅ Upload succeeds
- ✅ All 25 baselines created
- ✅ No errors in console

### Test: Upload 26 Files (Over Limit)
```bash
# Prepare 26 test images
for i in {1..26}; do
  cp test-image.png test-$i.png
done

# In browser:
1. Click "Upload Images"
2. Select all 26 files
3. Click "Upload"
```

**Expected:**
- ❌ Upload fails
- ❌ Error toast: "Maximum 25 files per upload"

### Test: Concurrent Uploads to Same screenId
```bash
# In browser console:
const file1 = ... // Create File object
const file2 = ... // Create File object with different content

// Simulate concurrent uploads to same screenId
Promise.all([
  backend.baselines.uploadMultiFs({
    baselines: [{
      screenId: "test-concurrent",
      name: "Test 1",
      imageData: btoa("..."),
      viewportWidth: 1280,
      viewportHeight: 720
    }]
  }),
  backend.baselines.uploadMultiFs({
    baselines: [{
      screenId: "test-concurrent",
      name: "Test 2",
      imageData: btoa("...different..."),
      viewportWidth: 1280,
      viewportHeight: 720
    }]
  })
]).then(console.log);
```

**Expected:**
- ✅ Both requests complete
- ✅ Only ONE baseline with screenId "test-concurrent" exists
- ✅ Last write wins (determined by lock order)

---

## ✅ 5. E2E Tests Verification

### Test: Run E2E Locally
```bash
# Terminal:
pnpm test:e2e
```

**Expected:**
- ✅ 7 tests pass (or expected number)
- ✅ Artifacts generated in tests/artifacts/
- ✅ No failures

### Test: View E2E Report
```bash
# Terminal (after running tests):
npx playwright show-report tests/artifacts/playwright-report
```

**Expected:**
- ✅ HTML report opens in browser
- ✅ All tests green
- ✅ Screenshots available (if any failures)

### Test: CI E2E Job
```bash
# In GitHub:
1. Push to main branch
2. Go to Actions tab
3. Find latest CI run
4. Check "e2e" job
```

**Expected:**
- ✅ Job completes successfully
- ✅ Artifacts uploaded (e2e-test-results)
- ✅ Download and verify artifacts

---

## ✅ 6. Metrics Measurement Verification

### Test: Run Metrics Locally
```bash
# Terminal (with demo app running):
pnpm test:metrics
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║  AI Output Gate - Metrics Measurement                         ║
╚════════════════════════════════════════════════════════════════╝

📊 Measuring runtime (single run)...
   ✅ Runtime: 45.23s

🔄 Measuring flake rate (repeatability check)...
   Running gate a second time...
   ✅ Second run: 46.12s
   ✅ Both runs passed - stable

════════════════════════════════════════════════════════════════
📈 METRICS SUMMARY
════════════════════════════════════════════════════════════════
Runtime:          45.68s (avg for 20 screens)
Flake Rate:       0.0% (target: ≤1%)
False Fail Rate:  0.0% (target: ≤2%)
Repeatability:    2/2 runs passed
════════════════════════════════════════════════════════════════

🎯 90% READY TARGETS:
   ✅ Flake Rate:      0.0% ≤ 1%
   ✅ False Fail Rate: 0.0% ≤ 2%
   ✅ Runtime:         45.68s ≤ 300s (5min)

✅ Metrics saved to: /workspace/artifacts/metrics.json
```

### Test: Verify Metrics JSON
```bash
# Terminal:
cat artifacts/metrics.json | jq .
```

**Expected:**
```json
{
  "timestamp": "2026-01-03T...",
  "runtime_seconds": 45.68,
  "total_screens": 20,
  "flake_rate": 0,
  "false_fail_rate": 0,
  "repeatability_pass_count": 2,
  "repeatability_total_count": 2,
  "notes": [
    "Both runs passed - stable baseline"
  ]
}
```

### Test: CI Metrics Job
```bash
# In GitHub:
1. Push to main branch
2. Go to Actions tab
3. Find latest CI run
4. Check "metrics" job
5. View job summary
```

**Expected:**
- ✅ Job completes successfully
- ✅ Metrics summary displayed in step summary
- ✅ Artifact uploaded (metrics.json, 30-day retention)

---

## ✅ 7. Manifest Backup Verification

### Test: Automatic Backups Created
```bash
# Terminal:
ls -la baselines/.backups/

# Expected:
manifest.2026-01-03T10-30-00-000Z.backup.json
manifest.2026-01-03T11-15-00-000Z.backup.json
...

# Check last backup
ls -la baselines/manifest.backup.json
```

**Expected:**
- ✅ Timestamped backups exist in .backups/
- ✅ manifest.backup.json is latest backup
- ✅ Max 5 backups kept (older ones rotated)

### Test: Backup on Upload
```bash
# Terminal:
# Note initial backup count
ls baselines/.backups/ | wc -l

# In browser:
1. Upload a new baseline
2. Wait for success toast

# Terminal:
ls baselines/.backups/ | wc -l
# Should be +1 (or same if rotation happened)
```

**Expected:**
- ✅ New backup created after upload
- ✅ Rotation keeps max 5

---

## ✅ 8. Production Readiness Checklist

### Final Checks
- [ ] Export ZIP download works
- [ ] Manifest recovery works (corrupt → recover → validate)
- [ ] Invalid masks rejected with clear errors
- [ ] Bulk upload limited to 25 files
- [ ] Concurrent uploads safe (per-screenId locks)
- [ ] E2E tests pass locally
- [ ] Metrics measurement completes successfully
- [ ] CI jobs all green (test, e2e, regression-validation, metrics)
- [ ] Backups created automatically
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No linting errors (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)

**If all checks pass:** ✅ Production-ready

---

## Troubleshooting

### E2E Tests Fail Locally
```bash
# Ensure fixtures exist
pnpm tsx tests/fixtures/create-fixtures.ts

# Run headed mode to see what's happening
pnpm test:e2e:headed
```

### Metrics Measurement Times Out
```bash
# Ensure demo app is running
pnpm demo:start

# In another terminal:
pnpm test:metrics
```

### Manifest Recovery Fails
```bash
# Check if backups exist
ls baselines/.backups/

# If no backups, recovery will rebuild from filesystem
# This is expected if no previous backups were created
```

### Upload Limit Not Working
```bash
# Check backend logs for the error
# Error should be: APIError.resourceExhausted
# Frontend should show error toast
```
