# Phase 1 Baseline Management Implementation

## Overview
This document describes the Phase 1 implementation of the Baseline Management system with strict scope enforcement.

## ✅ Implemented Features

### 1. Upload Images
- Multi-file drag & drop support
- File types: PNG, JPG, JPEG, WEBP (max 5MB each)
- Per-file editable metadata:
  - Screen ID (auto-inferred from filename)
  - Name (optional)
  - Route (optional)
  - Tags: standard/critical/noisy
  - Viewport dimensions (default 1280x720)
- Validations:
  - Blocks duplicate IDs within batch
  - Blocks non-image files
  - Warns on dimension mismatches
- Auto-validates and refreshes list after upload

### 2. Import ZIP
- Accepts .zip files up to 50MB
- Safe extraction with zip-slip prevention
- Two supported formats:
  
  **A) Repo Bundle:**
  ```
  baselines/manifest.json
  baselines/<id>/baseline.(png|jpg|jpeg|webp)
  baselines/<id>/screen.json (optional)
  .gate/policy.json (optional)
  ```
  
  **B) Flat Images:**
  - Images at root level
  - Screen IDs inferred from filenames
  
- Options:
  - Toggle "Overwrite existing screen IDs" (default OFF)
  - Checkbox "Import .gate/policy.json if included" (default OFF)
- Auto-validates and refreshes after import

### 3. Export ZIP
- Downloads: `baselines-export-YYYYMMDD-HHMM.zip`
- Includes:
  - baselines/manifest.json
  - baselines/<id>/baseline.*
  - baselines/<id>/screen.json (if exists)
  - .gate/policy.json (if exists)
  - README.txt with import instructions
- Never includes /runs

### 4. Baseline List/Table
- Filesystem-backed (reads from /baselines)
- Stats cards:
  - Total baselines
  - Validated
  - Invalid
  - Missing
- Table columns:
  - Screen ID
  - Name
  - Route
  - Tags
  - Viewport
  - Status (with tooltip for reason)
  - SHA256 hash (truncated with full hash on hover)
  - Updated time
- Row actions:
  - View (opens drawer)
  - Re-validate
- Status badges with clear visual indicators

### 5. Preview Drawer
- Shows:
  - Full baseline image
  - Metadata summary
  - Full SHA256 hash
  - Masks editor (CSS/Rect add/remove)
  - Resolved thresholds view (read-only)
  - Validation messages
- Edit mode:
  - Modify metadata
  - Add/remove masks (CSS selector or rectangle)
  - Toggle tags
  - Update viewport
  - Change route
- Buttons:
  - Save Changes (writes screen.json)
  - Re-validate
  - Download
  - Delete (with confirmation)

### 6. Reviewer Guidance Panel
- Collapsible panel with instructions
- Content:
  - Step-by-step PR review process
  - How to download artifacts from GitHub Checks
  - How to review report.html
  - How to approve baselines (add label in GitHub)
- Features:
  - Copy to clipboard button
  - Expandable "Understanding Test Results" section
  - Clear explanations of PASS/WARN/FAIL statuses
- No GitHub API integration (instructions only)

### 7. Git Friendliness Banner
- Appears when /baselines changes detected
- Message: "Baselines changed. Commit these changes to preserve version history."
- Shows count of modified files
- "Show Changed Files" button displays file list

### 8. Dark Theme
- Applied to entire UI
- Clean dark background with high contrast
- Accessible status colors:
  - Green for validated
  - Yellow for warnings
  - Red for errors
- Clear focus states
- Consistent spacing and alignment

### 9. Empty State
- Shown when no baselines exist
- Message: "No baselines yet"
- Buttons: Upload Images, Import ZIP
- Note: "Baselines saved to /baselines and should be committed to git."
- Lists supported workflows

## 🚫 Explicitly Excluded (Scope Enforcement)

- ❌ "Generate from routes" feature
- ❌ Multi-page dashboard
- ❌ Running Playwright from UI
- ❌ GitHub API integration (fetching artifacts, PRs, labels)
- ❌ Database storage (filesystem only)
- ❌ Remote storage (S3, etc.)
- ❌ Multi-tenant features
- ❌ User authentication/roles
- ❌ Analytics dashboards

## Backend Endpoints

All endpoints use filesystem storage at `/baselines`:

1. **GET /baselines/fs** - List all baselines with validation status
2. **GET /baselines/:screenId/image-fs** - Get baseline image (base64)
3. **POST /baselines/upload-multi-fs** - Upload multiple baseline images
4. **POST /baselines/import-zip-fs** - Import ZIP bundle
5. **GET /baselines/export-zip-fs** - Export ZIP bundle
6. **POST /baselines/:screenId/metadata-fs** - Update screen metadata
7. **POST /baselines/:screenId/validate-fs** - Re-validate baseline
8. **DELETE /baselines/:screenId/fs** - Delete baseline
9. **GET /baselines/git-status** - Check for uncommitted changes

## Validation Rules

### Status: Validated ✅
- Baseline image exists and readable
- SHA256 hash computed successfully
- If tagged "noisy", has at least one mask

### Status: Invalid ⚠️
- Duplicate screen IDs
- Manifest mismatch
- Tagged "noisy" but no masks configured

### Status: Missing ❌
- Baseline image file not found
- Image unreadable

## File Structure

```
/baselines/
  manifest.json              # Index of all baselines
  screen-01/
    baseline.png             # Baseline image
    screen.json              # Optional overrides
  screen-02/
    baseline.png
    screen.json
/.gate/
  policy.json                # Optional org-wide defaults
```

## Security Features

- Path sanitization (prevents traversal attacks)
- Zip-slip prevention in imports
- File size limits:
  - Images: 5MB max
  - ZIP: 50MB max
- File type validation
- Input validation on all endpoints

## Git Integration

- Tracks changes to /baselines and /.gate
- No automatic commits
- Shows banner when changes detected
- Lists modified files
- Encourages manual git workflow

## Acceptance Criteria Met

✅ Upload 3 images → list shows 3, statuses computed, dark theme consistent
✅ Import ZIP repo bundle → merges correctly; overwrite toggle works
✅ Export ZIP → imports back successfully
✅ Noisy without masks → Invalid; add mask → Validated
✅ Reviewer panel copy-to-clipboard works
✅ No "generate-from-routes" UI elements
✅ No dashboard beyond Baseline Management page
✅ No Playwright running from UI
✅ No GitHub API integration

## Tech Stack

### Frontend
- React with TypeScript
- Tailwind CSS v4 (dark theme)
- Lucide React icons
- shadcn/ui components

### Backend
- Encore.ts
- Node.js filesystem APIs
- AdmZip for ZIP handling
- crypto for SHA256 hashing

## Notes

- All baselines standardized to PNG on upload
- Viewport defaults to 1280x720 if not specified
- Manifest.json updated deterministically
- Screen.json only created when overrides exist
- Policy.json import is opt-in
