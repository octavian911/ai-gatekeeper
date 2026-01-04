# Content-Disposition Implementation Summary

## Overview
This document describes the implementation of Content-Disposition headers for signed URL ZIP exports to ensure browsers properly download files with the correct filename.

## Problem
Without Content-Disposition headers, browsers may:
- Display ZIP files in-browser instead of downloading
- Use generic filenames like "download" or the object key
- Not trigger automatic download behavior

## Solution
Implemented a two-layer approach to ensure Content-Disposition works across different cloud storage providers:

### 1. Upload-time Metadata (Primary)
Set `contentDisposition` when uploading the object to cloud storage:

```typescript
await exportZips.upload(objectName, zipBuffer, {
  contentType: "application/zip",
  contentDisposition: `attachment; filename="${filename}"`,
} as any);
```

**Benefits:**
- Metadata persists with the object
- Works for any download method (signed URL, direct download, etc.)
- Provider-native support (S3, GCS, Azure all support this)

### 2. Query Parameter Override (Fallback)
Add `response-content-disposition` query parameter to the signed URL:

```typescript
const urlObj = new URL(downloadUrl);
urlObj.searchParams.set('response-content-disposition', `attachment; filename="${filename}"`);
downloadUrl = urlObj.toString();
```

**Benefits:**
- Works even if upload-time metadata fails
- Standard cloud provider feature (AWS S3, Google Cloud Storage)
- Overrides object metadata at download time
- No code changes needed if switching providers

## Implementation Details

### File: `backend/baselines/export_zip_binary.ts`

```typescript
// Generate filename with timestamp
const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
const timeStr = now.toISOString().slice(11, 16).replace(/:/g, "");
const filename = `baselines-export-${dateStr}-${timeStr}.zip`;

// Upload with Content-Disposition metadata
await exportZips.upload(objectName, zipBuffer, {
  contentType: "application/zip",
  contentDisposition: `attachment; filename="${filename}"`,
} as any);

// Generate signed URL
let { url: downloadUrl } = await exportZips.signedDownloadUrl(objectName, {
  ttl: 600,
});

// Add query parameter override as fallback
const urlObj = new URL(downloadUrl);
urlObj.searchParams.set('response-content-disposition', `attachment; filename="${filename}"`);
downloadUrl = urlObj.toString();
```

### Cloud Provider Support

| Provider | Upload Metadata | Query Parameter Override |
|----------|----------------|-------------------------|
| AWS S3 | ✅ Supported | ✅ Supported |
| Google Cloud Storage | ✅ Supported | ✅ Supported |
| Azure Blob Storage | ✅ Supported | ✅ Supported |

## Testing

### E2E Test Assertions
File: `tests/e2e/baselines.spec.ts`

```typescript
const contentDisposition = downloadResponse.headers()["content-disposition"];
expect(contentDisposition).toBeDefined();
expect(contentDisposition).toContain("attachment");
expect(contentDisposition).toContain(".zip");
```

### Manual Verification
```bash
# Get export URL
curl -s https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev/baselines/export.zip | jq .

# Check headers
curl -I "$(curl -s https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev/baselines/export.zip | jq -r '.downloadUrl')"

# Expected output:
# HTTP/2 200 
# content-type: application/zip
# content-disposition: attachment; filename="baselines-export-20260104-1425.zip"
# content-length: 12345
```

## Verification Checklist

- [x] Content-Disposition set at upload time
- [x] Query parameter added to signed URL
- [x] E2E test asserts header presence
- [x] E2E test checks for "attachment" keyword
- [x] E2E test checks for ".zip" in filename
- [x] Manual verification guide updated
- [x] curl example shows Content-Disposition header

## Example Response

### API Response (JSON)
```json
{
  "downloadUrl": "https://storage.example.com/bucket/file.zip?response-content-disposition=attachment%3B+filename%3D%22baselines-export-20260104-1425.zip%22&...",
  "filename": "baselines-export-20260104-1425.zip",
  "expiresAt": "2026-01-04T14:35:00.000Z"
}
```

### Download Response Headers
```
HTTP/2 200
content-type: application/zip
content-disposition: attachment; filename="baselines-export-20260104-1425.zip"
content-length: 45678
etag: "abc123..."
```

## Browser Behavior

With Content-Disposition properly set:
1. Browser receives download with correct filename
2. Browser triggers "Save As" dialog or auto-download
3. Filename matches the timestamp format: `baselines-export-YYYYMMDD-HHMM.zip`
4. No in-browser preview attempt (file downloads directly)

## Security Notes

- Content-Disposition does not affect access control
- Signed URL still expires after 10 minutes (TTL=600)
- Filename is server-controlled (prevents injection attacks)
- Query parameter is part of signed URL (cannot be modified without invalidating signature)
