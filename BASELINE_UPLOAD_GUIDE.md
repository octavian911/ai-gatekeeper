# Baseline Upload Functionality

## Overview

The Baseline Management UI now supports full upload, import, and management capabilities for visual regression test baselines. Developers can ingest baseline images from Figma/Stitch exports, import ZIP archives, and manage baselines with a clean, deterministic workflow.

## Features

### 1. Upload Baselines (Images Tab)
- **Drag & drop** or **file picker** support for multiple images
- Supported formats: PNG, JPG, JPEG, WEBP (max 5MB each)
- **Automatic inference**: Screen IDs extracted from filenames
- **Inline editing** for each baseline:
  - Screen ID
  - Name
  - Route
  - Tags (standard, critical, noisy)
  - Viewport dimensions (default: 1280×720)
- **Bulk actions**:
  - Apply viewport to all baselines
  - Apply tags to selected baselines
- **Pre-upload validation**:
  - Warns about duplicate screen IDs
  - Warns if image dimensions don't match viewport
  - Warns if "noisy" tag used without masks
  - Shows detected image dimensions

### 2. ZIP Import
- Upload `.zip` files containing baseline structure (max 50MB)
- **Auto-detects** standard structure:
  ```
  baselines/
    manifest.json
    <screenId>/
      baseline.png (or screen.png)
      screen.json (optional)
  ```
- Extracts and validates all baselines
- Shows import summary with:
  - Total screens found
  - Missing files
  - Duplicate IDs
- Supports both `baseline.png` and `screen.png` filenames

### 3. Metadata Upload (Optional)
- Upload `screens.json` to provide additional metadata
- Merged with inferred data from uploaded images
- Schema: `{ id, name, route, viewport, tags }`

### 4. Empty State Guidance
When no baselines exist (Total = 0):
- Clear **"No baselines yet"** message
- **Guided instructions** on supported formats
- Prominent **Upload Baselines** and **Import ZIP** buttons
- Help text explaining naming conventions

### 5. Baseline Preview Drawer
Click any baseline row to open a right-side drawer showing:
- **Full-size image preview**
- **Metadata**: Screen ID, Route, Viewport, Status, Hash, File Size
- **Tags** display
- **Masks** list (CSS/rect) with add/remove UI
- **Thresholds** summary (resolved from policy + overrides)
- **Actions**:
  - Download baseline asset
  - Re-validate
  - Delete baseline (with confirmation)

### 6. Validation Rules
- **Missing**: Baseline image missing or unreadable
- **Invalid**: 
  - Manifest/metadata inconsistent
  - Viewport mismatch (if enforced)
  - Tag "noisy" without masks
  - Placeholder hash
- **Validated**: Image exists, hash computed, metadata OK

## Backend API Endpoints

### POST /baselines/upload-multi
Upload multiple baselines in one request
```typescript
{
  baselines: [{
    screenId: string,
    name: string,
    route?: string,
    tags?: string[],
    viewportWidth?: number,
    viewportHeight?: number,
    imageData: string, // base64
    masks?: Array<{ type, selector?, x?, y?, width?, height? }>,
    thresholds?: Record<string, number>
  }]
}
```

### POST /baselines/import-zip
Import baselines from ZIP archive
```typescript
{
  zipData: string // base64
}
```

### GET /baselines/:screenId
Get baseline metadata

### POST /baselines/:screenId/validate
Validate a specific baseline

### DELETE /baselines/:screenId
Delete baseline + metadata

### GET /baselines/:screenId/image
Download baseline image (base64)

## Database Schema

Baselines stored in PostgreSQL with:
```sql
CREATE TABLE baselines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route TEXT,
  tags TEXT[],
  viewport_width INTEGER DEFAULT 1280,
  viewport_height INTEGER DEFAULT 720,
  hash TEXT,
  status TEXT CHECK (status IN ('validated', 'invalid', 'missing')),
  status_message TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  file_size INTEGER,
  masks JSONB DEFAULT '[]',
  thresholds JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Storage

- **Object Storage**: Baseline images stored in Encore Bucket (`baseline-images`)
- **Path structure**: `<screenId>/<hash>.png`
- **Versioned**: Supports multiple versions per baseline
- **Public access**: Images accessible via public URLs
- **Hash integrity**: SHA256 hash computed and validated

## Security & Limits

- **Max file size**: 5MB per image
- **Max ZIP size**: 50MB
- **File type validation**: Only image types accepted
- **Sanitized filenames**: Prevents directory traversal
- **Zip slip protection**: Safe extraction with path validation
- **SQL injection protection**: Parameterized queries

## Usage Examples

### Upload 3 Images
1. Click **Upload Baselines**
2. Select **Images** tab
3. Drag & drop 3 PNG files
4. Verify Screen IDs inferred from filenames
5. Edit tags/viewport as needed
6. Click **Upload 3 baselines**
7. ✅ Total updates to 3, list shows rows with statuses

### Import ZIP
1. Click **Import ZIP**
2. Select **ZIP Import** tab
3. Choose `.zip` file with baselines/manifest.json
4. Review parsed summary
5. Click **Import ZIP**
6. ✅ Baselines appear instantly in list

### Tag Baseline as Noisy
1. Upload baseline
2. Add "noisy" tag
3. ❌ Status shows "Invalid" with reason: "requires at least one mask"
4. Add a mask via preview drawer
5. Click **Re-validate**
6. ✅ Status flips to "Validated"

### Handle Duplicates
1. Upload 2 images with same filename
2. ❌ UI blocks upload
3. ℹ️ Shows error: "Duplicate screen ID"
4. Rename one file
5. ✅ Upload proceeds

## CLI Compatibility

The UI is compatible with CLI-generated baseline structures:
- Supports same folder structure (`baselines/<screenId>/`)
- Reads `manifest.json` and `screen.json` files
- Respects CLI-generated hashes and metadata
- Can import CLI exports as ZIP

Developers can use both CLI and UI interchangeably for baseline management.

## Future Enhancements

- **Generate from app routes**: Auto-capture baselines from running app
- **Mask editor**: Visual mask drawing on baseline images
- **Threshold editor**: Override policy thresholds per baseline
- **Batch operations**: Delete/re-validate multiple baselines
- **Export**: Download baselines as ZIP for sharing
- **Diff view**: Compare baseline versions side-by-side
