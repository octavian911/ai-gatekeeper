# Baseline Ingestion Implementation

## Overview
Implemented a filesystem-based baseline management system that edits the repository's `/baselines` folder directly. This is a developer tool where versioning and audit happen via git commits/PRs.

## Storage Structure
```
/baselines/
  manifest.json                 # Central registry of all baselines
  <screenId>/
    baseline.png               # The baseline image
    screen.json (optional)     # Per-screen overrides (tags, masks, thresholds, viewport)

/.gate/
  policy.json (optional)       # Org-wide defaults
```

## Backend Endpoints (Filesystem-based)

All endpoints read/write to the `/baselines` folder directly (not a database):

### 1. List Baselines
- **Endpoint**: `GET /baselines/fs`
- **File**: `/backend/baselines/list_fs.ts`
- Reads `manifest.json` + filesystem to build baseline list
- Validates each baseline (checks for noisy tag without masks, missing images, etc.)
- Returns: BaselineMetadata[] with status, hash, tags, masks, thresholds

### 2. Upload Multiple Images
- **Endpoint**: `POST /baselines/upload-multi-fs`
- **File**: `/backend/baselines/upload_multi_fs.ts`
- Accepts array of baselines with image data (base64)
- Writes to `/baselines/<screenId>/baseline.png`
- Updates `manifest.json`
- Creates `screen.json` only if overrides provided (tags, viewport, etc.)
- Client-side validations: duplicate IDs, file size, image dimensions vs viewport

### 3. Import ZIP
- **Endpoint**: `POST /baselines/import-zip-fs`
- **File**: `/backend/baselines/import_zip_fs.ts`
- Accepts ZIP file with baselines structure
- Validates structure safely (prevents zip-slip attacks)
- Supports two modes:
  1. Structured: `baselines/manifest.json` + `baselines/<id>/baseline.png`
  2. Flat: Just images (infers screen IDs from filenames)
- Merge options:
  - `overwriteExisting`: toggle to overwrite existing baselines (default: skip)
  - `importPolicy`: toggle to import `.gate/policy.json` if present
- Returns: imported[], skipped[], errors[], summary

### 4. Update Metadata
- **Endpoint**: `POST /baselines/:screenId/metadata-fs`
- **File**: `/backend/baselines/update_metadata_fs.ts`
- Updates both `manifest.json` and `screen.json`
- Supports: name, route, tags, viewport, masks, thresholds

### 5. Get Image
- **Endpoint**: `GET /baselines/:screenId/image-fs`
- **File**: `/backend/baselines/get_image_fs.ts`
- Returns baseline image as base64 data URL

### 6. Validate Baseline
- **Endpoint**: `POST /baselines/:screenId/validate-fs`
- **File**: `/backend/baselines/validate_baseline_fs.ts`
- Re-validates baseline and returns status + hash
- Checks: image exists, noisy tag has masks

### 7. Delete Baseline
- **Endpoint**: `DELETE /baselines/:screenId/fs`
- **File**: `/backend/baselines/delete_baseline_fs.ts`
- Removes folder + updates manifest

### 8. Git Status
- **Endpoint**: `GET /baselines/git-status`
- **File**: `/backend/baselines/git_status.ts`
- Checks git status for uncommitted changes in `/baselines` and `/.gate`
- Returns: hasChanges, baselinesChanged, changedFiles[]

## Frontend Components

### 1. BaselineUploadModal
- **File**: `/frontend/components/BaselineUploadModal.tsx`
- Drag & drop + file picker for multiple images
- Per-image configuration:
  - Screen ID (inferred from filename, editable)
  - Name, route
  - Tags (standard/critical/noisy)
  - Viewport (default 1280×720)
- Bulk actions:
  - Apply viewport to all
  - Apply tag to selected
  - Validate all
- Client-side validations:
  - Duplicate screen IDs
  - Image dimensions vs viewport mismatch warning
  - File size limit (5MB)

### 2. ImportZipModal
- **File**: `/frontend/components/ImportZipModal.tsx`
- Drag & drop + file picker for ZIP files
- Shows validation summary after file selection
- Options:
  - Overwrite existing baselines (checkbox, default OFF)
  - Import policy.json (checkbox, shown only if ZIP contains it)
- Expected structure help text

### 3. BaselinePreviewDrawer
- **File**: `/frontend/components/BaselinePreviewDrawer.tsx`
- Right-side drawer with:
  - Baseline image preview
  - Metadata display (ID, route, viewport, status, hash)
  - Tags editor (standard/critical/noisy)
  - Masks editor:
    - Add CSS mask (selector input)
    - Add rect mask (x, y, width, height inputs)
    - Remove masks
  - Resolved thresholds display (based on tags)
  - Policy warnings (e.g., noisy requires masks)
  - Actions: Download, Re-validate, Delete, Edit mode with Save/Cancel

### 4. BaselinesPage (Updated)
- **File**: `/frontend/pages/BaselinesPage.tsx`
- Git status banner when uncommitted changes detected
- Primary CTAs:
  - "Upload Images" button
  - "Import ZIP" button
- Stats cards: Total, Validated, Invalid, Missing
- Search + filter by status
- Grid of baseline cards
- Empty state with guided instructions
- Integrates all modals and drawer

## Validation Rules

### Valid Baseline
- baseline.png exists and is readable
- If tagged "noisy", must have at least one mask
- Metadata is consistent with manifest

### Invalid Baseline
- Image exists but:
  - Duplicate screen IDs
  - Noisy tag with zero masks
  - Manifest references missing files

### Missing Baseline
- baseline.png is missing or unreadable

## Git-Friendliness

All writes only touch:
- `/baselines/**/*`
- `/.gate/policy.json` (only if user explicitly imports it)

Never writes to `/runs` or other directories.

Shows banner when uncommitted baseline changes detected.

## Security

- ZIP extraction uses path sanitization to prevent zip-slip attacks
- No execution of untrusted code
- File size limits enforced (5MB per image, 50MB per ZIP)

## Acceptance Criteria

✅ Upload 3 images → baselines folder populated, manifest created, table shows 3 validated rows
✅ Import ZIP containing baselines → merge works, overwrite toggle works
✅ Tag a screen as noisy without masks → shows Invalid with reason
✅ Adding a mask flips to Validated after revalidate
✅ Preview drawer shows image + hash + metadata + masks editor
✅ Refresh reloads from filesystem state
✅ Git banner shows when baselines changed

## Type Definitions

Key interfaces exported:
- `BaselineMetadata` (from `list_fs.ts`)
- `BaselineInput` (from `BaselineUploadModal.tsx`)
- `ImportZipRequest`, `ImportZipResponse` (from `import_zip_fs.ts`)

## Helper Functions

`/backend/baselines/filesystem.ts`:
- `readManifest()`, `writeManifest()`
- `readScreenConfig()`, `writeScreenConfig()`
- `readBaselineImage()`, `writeBaselineImage()`
- `deleteBaseline()`
- `getImageHash()`
- `getImageMtime()`
- `readPolicy()`, `writePolicy()`
