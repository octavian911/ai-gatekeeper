# SPA Deep-Link Routing Fix - Verification Guide

## Changes Made

### 1. SPA Fallback Configuration
- **File**: `/encore.json` (created)
- **Purpose**: Configures Encore.ts to serve the frontend with SPA fallback enabled
- **Details**: When a user refreshes on a client route (e.g., `/baselines`, `/docs/install`), the server will serve `index.html` with HTTP 200, allowing React Router to handle the routing client-side

### 2. Theme Contrast Test Fix
- **File**: `/frontend/components/BaselineCard.tsx:132`
- **Change**: Changed `text-muted-foreground` to `text-label` for the "No baseline image found" message
- **Reason**: Pre-existing test failure - `text-muted-foreground` should only be used for placeholders/hints, not for actual labels or messages

### 3. Diagnostic Tests
- **File**: `/tests/e2e/routing-diagnosis.spec.ts` (created)
- **Purpose**: Server-level verification that HTML is served for client routes
- **Tests**:
  - GET `/baselines` returns 200 with `text/html`
  - GET `/docs/install` returns 200 with `text/html`
  - GET API endpoints still return JSON
  - GET unknown routes return 200 with `text/html` (SPA fallback)

### 4. Existing Routing Tests
- **File**: `/tests/e2e/routing.spec.ts` (pre-existing)
- **Tests**: Already comprehensive, includes:
  - Hard refresh on `/baselines` stays on `/baselines`
  - Hard refresh on `/docs/install` stays on `/docs/install`
  - Hard refresh on `/docs/reviewers` stays on `/docs/reviewers`
  - Root `/` shows landing page
  - Unknown routes redirect to `/`
  - API routes not affected
  - Browser back/forward navigation works

## How to Verify Manually

### 1. Deep Link to `/baselines`
1. Open your browser to: `https://ai-output-gate-d5c156k82vjumvf6738g.lp.dev/baselines`
2. **Expected**: Page loads showing "Baseline Management" heading
3. Press `F5` or click the browser refresh button
4. **Expected**: URL stays `/baselines` and page shows "Baseline Management"
5. **Failure**: If URL changes to `/` or you see a 404

### 2. Deep Link to `/docs/install`
1. Open your browser to: `https://ai-output-gate-d5c156k82vjumvf6738g.lp.dev/docs/install`
2. **Expected**: Page loads showing installation documentation
3. Press `F5` or click the browser refresh button
4. **Expected**: URL stays `/docs/install` and documentation is still visible
5. **Failure**: If URL changes or you see a 404

### 3. Deep Link to `/docs/reviewers`
1. Open your browser to: `https://ai-output-gate-d5c156k82vjumvf6738g.lp.dev/docs/reviewers`
2. **Expected**: Page loads showing reviewer documentation
3. Press `F5` or click the browser refresh button
4. **Expected**: URL stays `/docs/reviewers` and documentation is still visible

### 4. Deep Link to `/reviews`
1. Open your browser to: `https://ai-output-gate-d5c156k82vjumvf6738g.lp.dev/reviews`
2. **Expected**: Page loads showing "QA Reviews" heading
3. Press `F5` or click the browser refresh button
4. **Expected**: URL stays `/reviews` and page shows the reviews list

### 5. Unknown Route Handling
1. Open your browser to: `https://ai-output-gate-d5c156k82vjumvf6738g.lp.dev/random-nonexistent-page`
2. **Expected**: React Router redirects you to `/` (Landing page)
3. **Expected**: URL bar shows `/` (not `/random-nonexistent-page`)

### 6. API Endpoints Still Work
1. Open: `https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev/baselines.list`
2. **Expected**: JSON response, not HTML
3. **Expected**: HTTP 200 status code

## Technical Details

### What Changed

**Before**: Encore.ts was serving the frontend, but on hard refresh of client routes (like `/baselines`), it would either:
- Return a 404 (not found)
- Redirect to `/` (root)
- Not serve the `index.html` file

**After**: With `encore.json` configured with `"spa": true`, the Encore.ts platform now:
1. Serves `index.html` for all non-API, non-static-asset routes
2. Returns HTTP 200 (not 302 redirect)
3. Preserves the URL in the browser
4. Allows React Router to handle routing client-side

### How SPA Fallback Works

1. User navigates to `/baselines` directly or refreshes
2. Browser sends `GET /baselines` with `Accept: text/html`
3. Encore server checks:
   - Is this an API route? → No (API routes are `/baselines.list`, etc.)
   - Is this a static asset? → No (no file extension)
   - Does Accept header include `text/html`? → Yes
4. Server serves `/frontend/dist/index.html` with HTTP 200
5. Browser URL stays `/baselines`
6. React app loads, React Router sees URL is `/baselines`
7. React Router renders the `<BaselinesPage />` component

## CI Status

- ✅ All backend tests passing
- ✅ All frontend tests passing (including theme contrast test)
- ✅ Build successful
- ✅ E2E routing tests exist (in `/tests/e2e/routing.spec.ts`)
- ✅ Diagnostic tests added (in `/tests/e2e/routing-diagnosis.spec.ts`)

## Related Files

- `/encore.json` - SPA configuration
- `/frontend/App.tsx` - React Router configuration
- `/tests/e2e/routing.spec.ts` - E2E routing tests
- `/tests/e2e/routing-diagnosis.spec.ts` - Server response diagnostic tests
- `/frontend/components/BaselineCard.tsx` - Theme contrast fix (line 132)
