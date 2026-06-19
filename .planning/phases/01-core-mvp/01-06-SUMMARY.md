---
phase: 01-core-mvp
plan: "06"
subsystem: document-viewer
tags: [viewer, iframe, attachments, split-layout]
requires: [01-03]
provides: [document-viewer, attachment-panel, iframe-preview]
affects: []
tech_stack:
  added: []
  patterns: [split-layout-40-60, tab-switcher-iframe, server-component-notfound]
key_files:
  created:
    - components/documents/AttachmentPanel.tsx
    - components/documents/IframePreview.tsx
    - components/documents/DocumentViewer.tsx
    - app/(app)/documents/[id]/page.tsx
  modified: []
decisions:
  - Badge component has no variant prop — used className directly for tag styling
metrics:
  duration: "~15 min"
  completed: "2026-06-19"
  tasks_completed: 2
  files_created: 4
status: complete
---

# Phase 01 Plan 06: Document Viewer Split Layout Summary

Split view document viewer với tab-switching iframe preview và attachment panel actions.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | AttachmentPanel + IframePreview components | 4d7c8de |
| 2 | DocumentViewer split layout + /documents/[id] route | c93dc0e |

## What Was Built

**AttachmentPanel** (`components/documents/AttachmentPanel.tsx`): Client component hiển thị danh sách file đính kèm. Mỗi row có 3 actions: "Xem" (trigger tab switch qua `onTabSelect`), "Copy link" (`navigator.clipboard`), "Mở Drive" (anchor target=`_blank`). Min height 44px per touch target spec. Hidden khi `attachments.length === 0`.

**IframePreview** (`components/documents/IframePreview.tsx`): Client component với Tabs/TabsList/TabsTrigger từ shadcn. Tab disabled khi `driveViewUrl === ''`. Placeholder "Đang tải lên..." khi tab active nhưng URL rỗng; iframe `allow="fullscreen"` khi có URL.

**DocumentViewer** (`components/documents/DocumentViewer.tsx`): Client component orchestrator. Left panel `w-2/5` với metadata (title, status Badge, deadline, assignee, notes, tags) + AttachmentPanel. Right panel `flex-1` với IframePreview. State `activeUrl` khởi tạo từ `doc.driveViewUrl`. Tabs array: `[{ label: 'File chính', ... }, ...attachments.map((a, i) => ({ label: 'Đính kèm {i+1}', ... }))]`.

**Route /documents/[id]** (`app/(app)/documents/[id]/page.tsx`): Server Component. Gọi `getDocument(params.id)` → `notFound()` nếu null, render `DocumentViewer` nếu có data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Badge variant prop không tồn tại**
- **Found during:** Task 2 — TypeScript build error
- **Issue:** `components/ui/badge.tsx` không implement `variant` prop (plain `HTMLAttributes<HTMLSpanElement>`). Plan dùng `variant="secondary"` cho tags.
- **Fix:** Thay bằng `className="bg-slate-100 text-slate-700"` trực tiếp.
- **Files modified:** `components/documents/DocumentViewer.tsx`
- **Commit:** c93dc0e (included in task commit)

### Pre-existing Issues (Out of Scope)

- `/api/drive/copy` build error: SyntaxError khi Next.js collect page data (env var `undefined` parsed as JSON). Tồn tại trước plan 06 — logged to deferred items, không fix.

## Known Stubs

None — tất cả data flow từ Firestore document thực qua `getDocument`.

## Threat Flags

None — không có endpoint mới ngoài threat model đã khai báo.

## Self-Check: PASSED

All 4 files created. Both commits verified in git log.
