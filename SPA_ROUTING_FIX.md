# SPA Routing Fix - Deep Link Support

## Problem
Hard refreshes on routes like `/baselines` and `/docs/install` were potentially not working correctly, preventing users from bookmarking or directly accessing specific pages.

## Solution
Encore.ts **automatically provides SPA fallback routing** for frontend applications. No manual configuration is required. The framework detects the `/frontend` folder and serves it with proper SPA support out of the box.

### How It Works
- Encore.ts serves the frontend `index.html` for all non-API routes
- Client-side routing (React Router) handles the URL matching
- API routes (like `/baselines.list`) are not affected by the fallback
- Static assets are served normally

## Verification

### Manual Testing
Tested via WebBrowser tool:
- ✅ `/baselines` - stays on `/baselines` after hard refresh
- ✅ `/docs/install` - stays on `/docs/install` after hard refresh
- ✅ `/docs/reviewers` - stays on `/docs/reviewers` after hard refresh
- ✅ `/` - shows landing page
- ✅ `/random` - redirects to `/` (via client-side routing)
- ✅ `/baselines.list` API - returns JSON, not HTML

### Automated Testing
Created comprehensive E2E test suite in `/tests/e2e/routing.spec.ts`:

```typescript
- Hard refresh on /baselines
- Hard refresh on /docs/install
- Hard refresh on /docs/reviewers
- Root / shows landing page
- Unknown routes redirect to /
- API routes unaffected
- Direct navigation works
- Browser back/forward navigation works
```

## Files Changed

### Added
- `/tests/e2e/routing.spec.ts` - E2E routing tests

### Modified
- `/README.md` - Added note about deep link support in Architecture section

## Key Insight
Encore.ts/Leap has built-in frontend serving with SPA fallback. The `/frontend` folder is automatically detected, built, and served with proper routing support. No manual `api.static` configuration is needed.

## Acceptance Criteria Met
- ✅ Hard refresh on `/baselines` stays on `/baselines` and renders correctly
- ✅ Hard refresh on `/docs/install` stays on `/docs/install` and renders correctly
- ✅ Root `/` shows Landing page
- ✅ Unknown routes like `/random` redirect to `/` (via React Router)
- ✅ Network requests return 200 (not 302 or 404)
- ✅ API routes remain unaffected
- ✅ Tests added for all scenarios
- ✅ Documentation updated
