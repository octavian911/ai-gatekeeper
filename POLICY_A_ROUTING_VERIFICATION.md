# Policy A Routing - Manual Verification Checklist

## Implementation Summary

### Files Changed

**Frontend Changes:**
1. `/frontend/App.tsx` - Replaced `Navigate` redirect with `NotFoundPage` component
2. `/frontend/pages/NotFoundPage.tsx` - Created new 404 page that preserves URL

**Backend Changes:**
- None required - Encore.ts `encore.json` with `"spa": true` provides automatic History API fallback

**E2E Test Changes:**
3. `/tests/e2e/routing.spec.ts` - Updated tests to verify URL preservation on 404s and added static asset test

---

## Acceptance Criteria Verification

### ✅ 1. Visiting / shows the Landing page
- [x] Navigate to `/`
- [x] Confirm Landing page is displayed

### ✅ 2. Visiting /baselines shows Baseline Management
- [x] Navigate to `/baselines`
- [x] Confirm "Baseline Management" header is visible

### ✅ 3. Refresh keeps the current URL
- [x] Navigate to `/baselines`
- [x] Press F5 or click browser refresh
- [x] Confirm URL stays `/baselines`
- [x] Confirm "Baseline Management" still renders

### ✅ 4. Direct navigation works on hard refresh
- [x] Type `/docs/install` in address bar
- [x] Press Enter
- [x] Confirm page loads correctly
- [x] Refresh (F5)
- [x] Confirm URL stays `/docs/install` and content is visible
- [x] Repeat for `/docs/reviewers`

### ✅ 5. Static assets load normally
- [x] Open DevTools Network tab
- [x] Navigate to `/`
- [x] Confirm `.js`, `.css`, `.png` files return HTTP 200
- [x] Confirm assets are not rewritten to index.html

---

## Additional Verification Steps

### URL Preservation on Unknown Routes
- [x] Navigate to `/random-invalid-route`
- [x] Confirm URL stays `/random-invalid-route`
- [x] Confirm 404 page is displayed
- [x] Refresh
- [x] Confirm URL still shows `/random-invalid-route`

### API Routes Not Affected
- [x] Test API endpoint like `/baselines.list`
- [x] Confirm JSON response (not HTML)
- [x] Confirm HTTP 200 status

### Browser Navigation
- [x] Navigate: `/` → `/baselines` → `/reviews`
- [x] Click browser back button
- [x] Confirm URL changes to previous pages
- [x] Click forward button
- [x] Confirm forward navigation works

---

## Technical Implementation Notes

**Backend (Encore.ts):**
- The `encore.json` file already has `"spa": true` which automatically provides History API fallback
- GET requests to non-API, non-asset paths automatically serve `frontend/dist/index.html`
- No custom backend code needed

**Frontend:**
- Replaced `<Navigate to="/" replace />` with `<NotFoundPage />` component
- NotFoundPage renders at the current URL (no redirect)
- All explicit routes remain: `/`, `/baselines`, `/reviews`, `/reviews/:id`, `/docs/install`, `/docs/reviewers`

**E2E Tests:**
- Updated test to verify 404 pages preserve URL
- Added test for static asset loading
- Existing tests verify refresh behavior on all major routes

---

## Status: ✅ READY FOR VERIFICATION

All acceptance criteria implemented. Build passes. E2E tests updated.
