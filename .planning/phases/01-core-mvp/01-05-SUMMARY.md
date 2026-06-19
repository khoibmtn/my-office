---
phase: 01-core-mvp
plan: "05"
subsystem: document-list-ui
status: complete
tags: [ui, table, realtime, shadcn]
dependency_graph:
  requires: ["01-03", "01-04"]
  provides: ["document-list-page", "DocumentTable"]
  affects: ["app/(app)/documents/page.tsx", "app/(app)/layout.tsx"]
tech_stack:
  added: []
  patterns: ["shadcn Table", "useDocuments hook", "Firestore Timestamp formatting"]
key_files:
  created:
    - components/documents/DocumentTable.tsx
    - app/(app)/documents/page.tsx
    - app/(app)/layout.tsx
  modified: []
decisions:
  - "Badge component dùng className thay variant vì badge.tsx chỉ nhận HTMLAttributes"
  - "Layout dùng <div> wrapper thay vì fragment để support header + main structure"
metrics:
  duration: "~2 min"
  completed: "2026-06-19"
  tasks_completed: 2
  files_changed: 3
requirements:
  - REQ-06
---

# Phase 1 Plan 05: DocumentTable & Document List Page Summary

DocumentTable component với upload status states, document list page với useDocuments realtime hook, và header layout với CTA "Thêm văn bản".

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DocumentTable component | 61379ec | components/documents/DocumentTable.tsx |
| 2 | Document list page + header layout | 6801c43 | app/(app)/documents/page.tsx, app/(app)/layout.tsx |

## What Was Built

**DocumentTable** (`components/documents/DocumentTable.tsx`):
- Columns: Tiêu đề | Trạng thái | Deadline | Người nhận | 📎 | Ngày tạo | Actions
- `uploading`: Loader2 animate-spin trong status cell + disabled button với spinner
- `upload_failed`: Badge "Tải lên thất bại" (bg-red-100 text-red-600) + Button "Thử lại"
- Các trạng thái khác: Button "Xem trước" → navigate `/documents/[id]`
- Deadline quá hạn: text-red-600
- Attachment badge: `📎 N` nếu có

**Document list page** (`app/(app)/documents/page.tsx`):
- Loading: 3 Skeleton rows (h-12)
- Empty state: heading "Chưa có văn bản nào" + body "Nhấn \"Thêm văn bản\" để thêm văn bản đầu tiên."
- Data: render DocumentTable với documents từ useDocuments hook

**Layout** (`app/(app)/layout.tsx`):
- Header: logo "Văn bản" (text-xl font-semibold) + Button "Thêm văn bản" top-right
- Auth guard logic giữ nguyên (redirect /login nếu chưa đăng nhập)

## Deviations from Plan

**1. [Rule 1 - Bug] Badge component không có prop `variant`**
- Found during: Task 1 verification (tsc --noEmit)
- Issue: `badge.tsx` custom implementation chỉ nhận `React.HTMLAttributes<HTMLSpanElement>`, không có `variant` prop như shadcn mặc định
- Fix: Dùng `className` trực tiếp với màu Tailwind thay vì `variant`
- Files modified: components/documents/DocumentTable.tsx
- Commit: 61379ec (same task commit)

## Verification

- `npx tsc --noEmit`: 0 lỗi liên quan DocumentTable
- `npm run build`: ✓ Compiled successfully (lỗi `/api/drive/copy` là pre-existing runtime issue, không liên quan plan này)
- Grep confirms: "Tải lên thất bại", "Thử lại", "Xem trước", `animate-spin` có trong DocumentTable.tsx
- Empty state copy chính xác per UI-SPEC

## Self-Check: PASSED

- [x] `components/documents/DocumentTable.tsx` exists
- [x] `app/(app)/documents/page.tsx` exists  
- [x] `app/(app)/layout.tsx` exists
- [x] Commit 61379ec exists
- [x] Commit 6801c43 exists
