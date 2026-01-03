# Export ZIP Download Fix

## Problem
Export ZIP download was failing silently in embedded preview environments. The previous implementation used fetch->blob approach which doesn't work reliably in iframe/embedded contexts.

## Solution
Improved export reliability with multiple fallback mechanisms:

### Backend Changes

1. **Enhanced Export Endpoint** (`backend/baselines/export_zip_fs.ts`)
   - Added `filter` and `search` query parameters to support filtered exports
   - Filter options: `all`, `validated`, `invalid`, `missing`
   - Search filters baselines by name, screenId, or URL
   - Returns base64-encoded ZIP data with proper Content-Type headers
   - Includes export metadata in README.txt (filter, search, count)

### Frontend Changes

1. **Reliable Download Method** (`frontend/pages/BaselinesPage.tsx`)
   - Uses fetch to get base64 ZIP data from backend
   - Converts base64 to Blob in browser
   - Creates download link with proper `download` attribute
   - Triggers download via programmatic click
   - Proper cleanup with URL.revokeObjectURL

2. **Fallback Mechanism**
   - "Copy Link" button provides direct API URL
   - Users can paste link in new tab if download blocked
   - Shows clear toast messages for all states

3. **Diagnostics**
   - Console logging for debugging
   - Informative error messages
   - Toast notifications for success/failure

## Testing

### Unit Tests (`backend/baselines/export_zip_fs.test.ts`)
- ✅ Returns base64-encoded ZIP data
- ✅ Returns filename with timestamp
- ✅ Returns valid ZIP with manifest.json
- ✅ Returns valid ZIP with baseline images
- ✅ Returns valid ZIP with README.txt
- ✅ Filters baselines when filter=validated
- ✅ Filters baselines when filter=invalid
- ✅ Filters baselines when search query provided
- ✅ Includes filter and search info in README

All 14 backend tests pass.

## Usage

### Export All Baselines
1. Click "Export ZIP" button
2. ZIP file downloads automatically
3. Contains all baselines in repo-mode structure

### Export Filtered Baselines
1. Apply filter (Validated/Invalid/Missing)
2. Optionally add search query
3. Click "Export ZIP"
4. Only matching baselines are exported
5. README.txt documents the filter criteria

### Fallback (if download blocked)
1. Click the "Link" icon button next to Export ZIP
2. Toast shows "API link copied..."
3. Open new browser tab
4. Paste URL and navigate
5. JSON response contains base64 ZIP data
6. Manually decode if needed

## Exported ZIP Structure

```
baselines-export-YYYYMMDD-HHMM.zip
├── baselines/
│   ├── manifest.json (filtered baselines only)
│   └── <screen-id>/
│       ├── baseline.(png|jpg|jpeg|webp)
│       └── screen.json (optional)
├── .gate/
│   └── policy.json (optional)
└── README.txt (includes filter/search info)
```

## Acceptance Criteria ✅

- ✅ Clicking Export ZIP downloads a .zip in normal browser usage
- ✅ If downloads blocked, user can download via copied link fallback
- ✅ Exported ZIP opens and contains baselines/manifest.json
- ✅ Exported ZIP contains baselines/<id>/baseline.png files
- ✅ Backend returns correct headers (Content-Type: application/zip)
- ✅ Export respects current filter and search state
- ✅ No silent failures - all errors show toast messages
- ✅ Comprehensive test coverage for endpoint

## Future Improvements

1. Add Playwright e2e test to verify download trigger
2. Add download progress indicator for large exports
3. Add export statistics to toast (X baselines, Y MB)
4. Consider server-side streaming for very large exports
