---
phase: 01-core-mvp
plan: "07"
subsystem: data-layer
tags: [drive, firestore, form, lazy-init, bug-fix]
status: complete
dependency_graph:
  requires: []
  provides: [drive-lazy-init, firestore-field-fix, non-blocking-submit]
  affects: [lib/drive.ts, lib/firestore.ts, components/documents/DocumentForm.tsx]
tech_stack:
  added: []
  patterns: [lazy-init, fire-and-forget, D-07]
key_files:
  modified:
    - lib/drive.ts
    - lib/firestore.ts
    - components/documents/DocumentForm.tsx
decisions:
  - submitDocumentWithDriveCopy refactored to accept docId instead of CreateDocumentInput — enables D-07 split (createDocument → navigate → fire-and-forget Drive copy)
metrics:
  duration: "10m"
  completed: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 1 Plan 07: Gap Closure — Data Layer Fixes Summary

Lazy-init GoogleAuth in drive.ts, fix result.mainFile typo in firestore.ts, non-blocking D-07 submit pattern in DocumentForm.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Lazy-init GoogleAuth | d0cd34b | lib/drive.ts |
| 2 | result.main → result.mainFile typo fix | c0b22c0 | lib/firestore.ts |
| 3 | Non-blocking submit D-07 | 14dda86 | components/documents/DocumentForm.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] submitDocumentWithDriveCopy signature refactored**
- **Found during:** Task 3
- **Issue:** Plan D-07 requires `createDocument` called separately in the form to get `docId` before navigating, then fire-and-forget Drive copy. Old `submitDocumentWithDriveCopy(CreateDocumentInput)` internally called `createDocument` — impossible to split without changing signature.
- **Fix:** Refactored `submitDocumentWithDriveCopy` to accept `(docId, originalLink, attachments, folderId?)` — form now calls `createDocument` directly, navigates, then fire-and-forget Drive copy.
- **Files modified:** lib/firestore.ts, components/documents/DocumentForm.tsx
- **Commit:** c0b22c0, 14dda86

## Self-Check

- [x] lib/drive.ts: JSON.parse inside getAuthenticatedDrive() helper — not top-level
- [x] lib/firestore.ts line 108: result.mainFile
- [x] DocumentForm.tsx: no await on submitDocumentWithDriveCopy, router.push before fire-and-forget
- [x] npx tsc --noEmit — no errors
- [x] All 3 commits present in git log

## Self-Check: PASSED
