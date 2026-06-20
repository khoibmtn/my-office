# Roadmap: Ứng dụng Quản lý Văn bản

## Overview

Xây dựng ứng dụng web quản lý văn bản hành chính với khả năng lưu trữ trên Google Drive, tìm kiếm full-text qua Algolia, xem trước file qua iframe và quản lý công việc theo kanban. Stack: Next.js 14 (App Router) + Firestore + Firebase Auth + Google Drive API + Algolia + Vercel.

## Phases

- [x] **Phase 1: Core MVP** - Setup, auth, Drive integration, CRUD văn bản + đính kèm, Document Viewer
- [ ] **Phase 2: Search & Dashboard** - Algolia full-text search, Dashboard thống kê realtime
- [ ] **Phase 3: Task Management** - Kanban board, bulk actions, Command palette Cmd+K
- [ ] **Phase 4: Polish** - Dark mode, mobile responsive, CI/CD, Settings page

## Phase Details

### Phase 1: Core MVP

**Goal**: Ứng dụng chạy được end-to-end: login Google, thêm văn bản (kèm đính kèm), xem danh sách, xem trước file trong split view
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01 thông qua REQ-07
**Success Criteria** (what must be TRUE):

  1. User đăng nhập được bằng Google OAuth2
  2. User thêm văn bản với link file chính → file được copy vào Drive, metadata lưu Firestore
  3. User thêm 1+ file đính kèm khi tạo văn bản → mỗi file copy vào Drive song song
  4. Danh sách văn bản hiển thị dạng table với status, deadline, assignee
  5. Document Viewer: split view trái (metadata + attachment panel) + phải (iframe preview với tab switcher)
  6. User xem được file chính và từng đính kèm qua iframe tabs

**Plans:** 8/8 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Project scaffold + Firebase Auth + Google OAuth2 (drive.file scope)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Drive API copy endpoint + link detection

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — TypeScript types + Firestore CRUD + async submit + retry
- [x] 01-04-PLAN.md — DocumentForm + AttachmentInput (dynamic add/remove)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — DocumentTable + document list page
- [x] 01-06-PLAN.md — DocumentViewer split view + iframe tabs + AttachmentPanel

**Gap Closure** *(wave 1, independent)*

- [x] 01-07-PLAN.md — [GAP] Lazy-init drive.ts + fix result.mainFile typo + non-blocking submit (D-07)
- [x] 01-08-PLAN.md — [GAP] Remove broken middleware cookie check

### Phase 2: Search & Dashboard

**Goal**: Tìm kiếm full-text tức thì qua Algolia; Dashboard hiển thị thống kê và deadline realtime
**Depends on**: Phase 1
**Requirements**: REQ-08, REQ-09
**Success Criteria** (what must be TRUE):

  1. Gõ keyword → kết quả xuất hiện tức thì với highlight, badge số đính kèm
  2. Filter được theo status, deadline, assignee
  3. Dashboard hiển thị StatsGrid (tổng, pending, overdue), DeadlineTimeline (ProgressChart deferred per D-10)
  4. Dashboard cập nhật realtime khi có thay đổi (Firestore onSnapshot)

**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Algolia setup: client/server helpers + sync injection + useSearch hook (Wave 1)
- [x] 02-02-PLAN.md — Search page: SearchClient + SearchFilters + SearchResultCard + /search route (Wave 2)
- [ ] 02-03-PLAN.md — Dashboard: StatsGrid + DeadlineTimeline + useDeadlineDocuments + trang chủ (Wave 2)

### Phase 3: Task Management

**Goal**: Kanban board kéo thả, bulk actions, Command palette Cmd+K
**Depends on**: Phase 2
**Requirements**: REQ-10, REQ-11, REQ-12
**Success Criteria** (what must be TRUE):

  1. Kanban board hiển thị documents theo status, kéo thả để đổi status (dnd-kit)
  2. Chọn nhiều documents → bulk đổi status / assign
  3. Cmd+K mở command palette → tìm kiếm instant toàn bộ văn bản

**Plans**: TBD

### Phase 4: Polish

**Goal**: Dark mode, mobile responsive, CI/CD pipeline, Settings page chọn Drive folder
**Depends on**: Phase 3
**Requirements**: REQ-13, REQ-14, REQ-15, REQ-16
**Success Criteria** (what must be TRUE):

  1. Dark mode toggle hoạt động, persist qua sessions
  2. Layout đọc được và dùng được trên mobile (≥375px)
  3. Push to GitHub → Vercel auto-deploy, preview deploys cho PRs
  4. Settings page: chọn/tạo Drive folder chỉ định, lưu vào Firestore /settings/user

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core MVP | 8/8 | Complete    | 2026-06-19 |
| 2. Search & Dashboard | 2/3 | In progress | - |
| 3. Task Management | 0/TBD | Not started | - |
| 4. Polish | 0/TBD | Not started | - |
