# Optimistic Updates Implementation

This document describes the optimistic updates implementation for the BaselinesPage component.

## Overview

Optimistic updates provide immediate UI feedback to users before backend operations complete, improving perceived performance and user experience. If backend operations fail, the UI automatically rolls back and displays error notifications.

## Implementation Details

### 1. Toast Notification System

Created a custom toast hook (`/frontend/hooks/useToast.tsx`) that provides:
- Success, error, and warning toast notifications
- Auto-dismiss after 4 seconds
- Manual dismiss capability
- Positioned in top-right corner with proper z-index
- Animated entrance with slide-in effect

### 2. BaselinesPage Optimistic Updates

Updated `/frontend/pages/BaselinesPage.tsx` to implement optimistic updates for:

#### a. **Baseline Validation** (`handleValidate`)
- **Optimistic Update**: Immediately marks baseline as validated in UI
- **Rollback**: Restores previous state if backend validation fails
- **Notification**: Shows success/error toast

#### b. **Baseline Deletion** (`handleDelete`)
- **Optimistic Update**: Immediately removes baseline from list
- **Rollback**: Restores deleted baseline if backend deletion fails
- **Side Effects**: Closes preview drawer if the deleted baseline is currently open
- **Notification**: Shows success/error toast with baseline name

#### c. **Baseline Upload** (`handleUploadBaselines`)
- **Optimistic Update**: Immediately adds new baselines to the list with:
  - Temporary "uploading..." hash
  - Proper validation status based on tags
  - All metadata from user inputs
- **Rollback**: Restores previous baseline list if upload fails
- **Notification**: Shows count of uploaded baselines and any errors
- **Supports**: Both new baselines and updates to existing ones

#### d. **Metadata Updates** (`handleUpdateMetadata`)
- **Optimistic Update**: Immediately updates baseline metadata and preview drawer
- **Rollback**: Restores both baseline list and drawer state if update fails
- **Notification**: Shows success/error toast

#### e. **ZIP Import** (`handleImportZip`)
- **Optimistic Update**: Not applied (complex operation with multiple baselines)
- **Rollback**: Restores previous state if import fails
- **Notification**: Shows import results with counts and errors via toast instead of alert

#### f. **ZIP Export** (`handleExportZip`)
- **No Optimistic Update**: Read-only operation
- **Notification**: Shows success/error toast instead of alert

## Technical Approach

### State Management
- Stores previous state before each operation using spread operator: `[...baselines]`
- Updates state immediately with optimistic values
- Rolls back to previous state on error

### Error Handling
- All operations wrapped in try-catch blocks
- Console.error for debugging
- Toast notifications for user feedback
- Proper error propagation for upload modal

### Type Safety
- All optimistic updates create proper `BaselineMetadata` objects
- Includes all required fields: `screenId`, `name`, `url`, `status`, `hash`, etc.
- Proper handling of optional fields with `undefined` instead of `null`

### useCallback Hook
- All handler functions wrapped in `useCallback` to prevent unnecessary re-renders
- Proper dependency arrays to ensure callbacks have latest state

## User Experience Improvements

1. **Immediate Feedback**: Users see changes instantly without waiting for server response
2. **Error Recovery**: Failed operations automatically revert with clear error messages
3. **Non-blocking**: Users can continue interacting while operations complete
4. **Clear Communication**: Toast notifications replace intrusive alerts
5. **Consistency**: All operations follow the same optimistic update pattern

## Files Modified

1. `/frontend/pages/BaselinesPage.tsx` - Main page component with all optimistic updates
2. `/frontend/hooks/useToast.tsx` - New custom toast notification hook

## Testing Recommendations

1. Test each operation with network throttling to see optimistic updates in action
2. Test error scenarios by simulating backend failures
3. Verify rollback behavior by checking state before/after failed operations
4. Test concurrent operations (e.g., deleting while validating)
5. Verify toast notifications appear and auto-dismiss correctly
