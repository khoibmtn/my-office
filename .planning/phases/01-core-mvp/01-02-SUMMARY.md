---
phase: 01-core-mvp
plan: "02"
subsystem: drive-api
status: complete
tags: [next.js, googleapis, google-drive, service-account, tdd]
dependency_graph:
  requires: [01-01]
  provides: [link-detector, drive-copy-api, drive-permissions]
  affects: [01-03, 01-04, 01-05]
tech_stack:
  added:
    - vitest@4 (devDependency — test runner)
  patterns:
    - TDD RED/GREEN cycle (vitest)
    - Service Account auth via googleapis GoogleAuth
    - Promise.all for parallel attachment copy (REQ-03)
    - driveViewUrl format /preview (D-04)
key_files:
  created:
    - lib/link-detector.ts
    - lib/link-detector.test.ts
    - lib/drive.ts
    - app/api/drive/copy/route.ts
  modified: []
decisions:
  - "driveViewUrl dùng /preview format (không phải webViewLink từ Drive API) — per D-04"
  - "folderId fallback to DRIVE_FOLDER_ID env var — client không tự chỉ định folder (T-02-01)"
  - "Phase 1 chỉ support type 'drive'; docs/url throw Error rõ ràng"
  - "copyAttachmentsToDrive dùng Promise.all — không await tuần tự (REQ-03)"
metrics:
  duration: "~10 phút"
  completed: "2026-06-19"
  tasks_completed: 2
  files_created: 4
---

# Phase 1 Plan 02: Drive API Copy Endpoint Summary

Server-side Drive API layer với Service Account auth, link detection (drive/docs/url), file copy + permission setting, và parallel attachments copy qua POST /api/drive/copy.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | lib/link-detector.ts — detectLinkType, extractDriveFileId (TDD, 6 tests) | 1ab255f | Done |
| 2 | lib/drive.ts + app/api/drive/copy/route.ts — Service Account copy + permissions | ecca7ea | Done |

## What Was Built

**lib/link-detector.ts** — Pure functions: `extractDriveFileId` (regex `/d/([id])`), `detectLinkType` phân biệt drive/docs/url. Exports: `LinkType`, `DetectResult`, `detectLinkType`, `extractDriveFileId`.

**lib/drive.ts** — Server-only Drive API helpers. `copyFileToDrive` gọi `files.copy` + `permissions.create` (role: reader, type: anyone). `copyAttachmentsToDrive` dùng `Promise.all`. `driveViewUrl` luôn dùng format `/preview`.

**app/api/drive/copy/route.ts** — POST handler nhận `{ originalLink, attachments?, folderId? }`. `folderId` fallback to `DRIVE_FOLDER_ID` env var. Chạy main file + attachments copy song song với `Promise.all`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Vitest không có sẵn trong project**
- **Found during:** Task 1 (TDD setup)
- **Issue:** `package.json` không có vitest; plan yêu cầu `npx vitest run`
- **Fix:** `npm install --save-dev vitest` trước khi viết tests
- **Files modified:** `package.json`, `package-lock.json`

**2. [Rule 3 - Blocking] Git repo chưa được khởi tạo**
- **Found during:** Task 1 commit
- **Issue:** Working directory không phải git repo (per env context)
- **Fix:** `git init` + tạo `.gitignore` (node_modules, .next, .env.local)
- **Files modified:** `.gitignore` (new)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| lib/link-detector.ts | FOUND |
| lib/link-detector.test.ts | FOUND |
| lib/drive.ts | FOUND |
| app/api/drive/copy/route.ts | FOUND |
| commit 1ab255f | FOUND |
| commit ecca7ea | FOUND |
| 6 vitest tests | PASSED |
