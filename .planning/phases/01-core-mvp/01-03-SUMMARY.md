---
phase: 01-core-mvp
plan: "03"
subsystem: data-layer
status: complete
tags: [typescript, firestore, react-hooks, realtime, retry-logic]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [typescript-types, firestore-crud, realtime-hook]
  affects: [01-04, 01-05, 01-06]
tech_stack:
  added: []
  patterns:
    - Async submit với immediate status 'uploading' (D-07)
    - Exponential backoff retry max 3 lần [1s, 2s, 4s] (D-08)
    - onSnapshot realtime listener
    - Lazy db() singleton từ lib/firebase.ts
key_files:
  created:
    - types/index.ts
    - lib/firestore.ts
    - hooks/useDocuments.ts
  modified: []
decisions:
  - "db() lazy singleton — tránh server-side init error (pattern từ 01-01)"
  - "retryWithBackoff là private helper — không export, chỉ dùng trong submitDocumentWithDriveCopy"
  - "onStatusChange callback optional — UI có thể react hoặc ignore"
  - "orderBy createdAt desc trong useDocuments — mới nhất lên đầu"
metrics:
  duration: "~2 phút"
  completed: "2026-06-19"
  tasks_completed: 2
  files_created: 3
---

# Phase 1 Plan 03: TypeScript Types + Firestore Data Layer Summary

TypeScript types đầy đủ cho Document schema, Firestore CRUD layer với async submit + 3-retry exponential backoff, và realtime onSnapshot hook.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | types/index.ts — Document, Attachment, DocumentStatus, CreateDocumentInput | 554d0e9 | Done |
| 2 | lib/firestore.ts + hooks/useDocuments.ts — CRUD, retry, realtime | 5b3b941 | Done |

## What Was Built

**types/index.ts** — `DocumentStatus` union (pending/in_progress/completed/overdue/uploading/upload_failed), `Attachment` với `uploadedAt: Timestamp`, `Document` với `attachments: Attachment[]`, `AttachmentInput`, `CreateDocumentInput`.

**lib/firestore.ts** — `createDocument` lưu ngay status 'uploading' (D-07). `submitDocumentWithDriveCopy` orchestrate D-07+D-08: tạo doc → POST /api/drive/copy với retry 3 lần backoff [1s,2s,4s] → `updateDocumentDriveInfo` hoặc `updateDocumentStatus('upload_failed')`. Private `retryWithBackoff<T>` helper. `getDocument`, `updateDocumentStatus` cho các use case khác.

**hooks/useDocuments.ts** — Client hook, `onSnapshot` collection 'documents' orderBy createdAt desc, return `{ documents: Document[], loading: boolean }`.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| types/index.ts | FOUND |
| lib/firestore.ts | FOUND |
| hooks/useDocuments.ts | FOUND |
| tsc --noEmit (no errors) | PASSED |
| grep "uploading" lib/firestore.ts | 2 matches |
| grep "retry\|backoff" lib/firestore.ts | 2 matches |
| grep "onSnapshot" hooks/useDocuments.ts | 2 matches |
| commit 554d0e9 | FOUND |
| commit 5b3b941 | FOUND |
