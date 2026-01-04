# PR Comment Summary Hardening

## Overview
Enhanced the PR comment behavior to prevent spam, improve usability, and handle fork/permission scenarios gracefully.

## Changes Made

### 1. Stable Hidden Marker
- Changed marker from `<!-- ai-gate-summary -->` to `<!-- ai-gatekeeper-summary -->`
- Marker is now a constant (`COMMENT_MARKER`) in `packages/cli/src/github.ts:62`
- Ensures consistent identification across all PR comments

### 2. Find-or-Update Logic
- Implemented in `packages/cli/src/github.ts:70-118`
- **Behavior:**
  - Lists all existing PR comments
  - Searches for comment containing the marker
  - If found: **Updates** the existing comment (PATCH)
  - If not found: **Creates** a new comment (POST)
- **Result:** Only one summary comment per PR, always up-to-date

### 3. Improved Comment Usability

#### Run Information Section
Added to `packages/cli/src/pr-summary.ts:20-26`:
- Run ID (e.g., `run-1234567890`)
- Commit short SHA (first 7 chars, e.g., `abc123d`)

#### Evidence Artifact Instructions
Added to `packages/cli/src/pr-summary.ts:51-59`:
```markdown
### Where to Find Evidence Artifacts

To view detailed comparison images and reports:

1. Go to the **Checks** tab on this PR
2. Click on the workflow job that ran the visual tests
3. Scroll to the **Artifacts** section
4. Download the `ai-gate-evidence` artifact
5. Unzip and open `report.html` to review all comparisons
```

### 4. Fork/Permission Safety

#### Enhanced Error Handling (`packages/cli/src/github.ts`)
- Detects 403 (Forbidden) and 404 (Not Found) responses
- Provides contextual error messages mentioning forks and permissions
- Errors include actionable hints (e.g., "Grant write permissions to GITHUB_TOKEN")

#### Non-Failing Behavior (`packages/cli/src/commands/gate.ts:146-163`)
- Gate run **continues** even if comment posting fails
- Detects fork/permission errors specifically
- Prints user-friendly console messages:
  ```
  ⚠ Unable to post PR comment
    Reason: PR may be from a fork or workflow lacks comment permissions
    Tip: Grant write permissions to GITHUB_TOKEN in workflow file
    Gate will continue - check Artifacts for evidence
  ```
- Fallback: Prints summary to CI logs with evidence location
- **Critical:** Gate exit code is NOT affected by comment failures

### 5. Unit Tests

#### `packages/cli/src/github.test.ts`
Tests for find-or-update logic:
- ✅ Find comment with marker
- ✅ Return undefined when no marker found
- ✅ Handle empty comments array
- ✅ Create new comment when none exists
- ✅ Update existing comment when marker found
- ✅ Descriptive errors for 403 (list, update, create)
- ✅ Descriptive errors for 404
- ✅ Preserve marker in body

#### `packages/cli/src/pr-summary.test.ts`
Tests for summary formatting:
- ✅ Include run information (run ID, commit SHA)
- ✅ Include artifact download instructions
- ✅ Correct status emojis (✅ ⚠️ ❌)
- ✅ Omit zero-count sections
- ✅ Format similarity percentage
- ✅ Work without optional fields
- ✅ `computeRunStatus` prioritization (FAIL > WARN > PASS)
- ✅ `computeWorstSimilarity` calculations

## Files Modified

1. `/packages/cli/src/github.ts` - Enhanced error handling, find-or-update logic
2. `/packages/cli/src/pr-summary.ts` - Added run info, artifact instructions
3. `/packages/cli/src/commands/gate.ts` - Fork/permission safety, better console output

## Files Created

1. `/packages/cli/src/github.test.ts` - Unit tests for GitHub API interactions
2. `/packages/cli/src/pr-summary.test.ts` - Unit tests for summary formatting

## Example Output

### Successful PR Comment
```markdown
<!-- ai-gatekeeper-summary -->
## ✅ Visual Regression Gate: Passed

### Run Information

- **Run ID**: `run-1704369540123`
- **Commit**: `abc123d`

### Summary

- **Status**: PASS
- **Total Screens**: 5
- **Passed**: 5

### Where to Find Evidence Artifacts

To view detailed comparison images and reports:

1. Go to the **Checks** tab on this PR
2. Click on the workflow job that ran the visual tests
3. Scroll to the **Artifacts** section
4. Download the `ai-gate-evidence` artifact
5. Unzip and open `report.html` to review all comparisons
```

### Console Output (Fork Scenario)
```
⚠ Unable to post PR comment
  Reason: PR may be from a fork or workflow lacks comment permissions
  Tip: Grant write permissions to GITHUB_TOKEN in workflow file
  Gate will continue - check Artifacts for evidence

📊 Summary (for CI logs):
  Run ID: run-1704369540123
  Commit: abc123d
  Status: PASS
  Total: 5
  Passed: 5
  Failed: 0
  Worst Similarity: 100.00%

📦 Evidence Location:
  Checks tab → Workflow job → Artifacts → Download ai-gate-evidence
```

## Testing

All tests pass successfully:
```bash
cd /packages/cli
npm test
```

Build verification:
```bash
npm run build
```

## Backward Compatibility

- ✅ Old marker `<!-- ai-gate-summary -->` will be replaced by new marker on next run
- ✅ Existing workflows continue working without changes
- ✅ Fork PRs gracefully degrade to console-only output
