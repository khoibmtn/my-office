---
phase: 02-search-dashboard
plan: "02"
subsystem: search
tags: [search, algolia, ui, components]
dependency_graph:
  requires: [algolia-client, useSearch-hook]
  provides: [search-page, search-ui]
  affects: []
tech_stack:
  added: []
  patterns: [lifted-state, dangerouslySetInnerHTML-highlight, debounced-search]
key_files:
  created:
    - components/search/SearchResultCard.tsx
    - components/search/SearchFilters.tsx
    - components/search/SearchClient.tsx
    - app/(app)/search/page.tsx
  modified: []
decisions:
  - Badge dùng className thay variant (badge.tsx chỉ nhận HTMLAttributes, không có variant prop)
  - Checkbox dùng native HTML input[type=checkbox] — không có shadcn Checkbox component trong project
  - Deadline date inputs dùng native input[type=date] với getTime() để convert sang unix ms
metrics:
  duration: ~8 minutes
  completed: "2026-06-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
status: complete
---

# Phase 2 Plan 02: Search UI Summary

Search page với instant search UI — debounced input → Algolia → result cards với title highlight, sidebar filters cho status/deadline/assignee.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SearchResultCard + SearchFilters | 3a0bdca | components/search/SearchResultCard.tsx, components/search/SearchFilters.tsx |
| 2 | SearchClient + search page | e5348c6 | components/search/SearchClient.tsx, app/(app)/search/page.tsx |

## What Was Built

**components/search/SearchResultCard.tsx** — Card component render một Algolia hit. Title highlight qua `dangerouslySetInnerHTML` với `_highlightResult.title.value` (Algolia `em` tags styled `font-semibold text-blue-600 not-italic`). Status badge dùng className map. Deadline format bằng `Intl.DateTimeFormat('vi-VN')`. Link tới `/documents/{objectID}`.

**components/search/SearchFilters.tsx** — Sidebar 250px: status checkboxes (pending/in_progress/completed/upload_failed), deadline date range (2 native date inputs convert sang unix ms), assignee text input. Filters state lifted lên SearchClient qua `onChange` prop.

**components/search/SearchClient.tsx** — `'use client'` component: controlled `query` state + `SearchFilters` state, gọi `useSearch(query, filters)`. Layout: full-width input trên, row dưới gồm sidebar + results. Loading/empty/no-query states handled.

**app/(app)/search/page.tsx** — Server Component shell, export `metadata`, render `<SearchClient />`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn Checkbox không có trong project**
- **Found during:** Task 1
- **Issue:** Plan yêu cầu dùng `shadcn Checkbox` nhưng `components/ui/` chỉ có: badge, button, card, dialog, input, label, skeleton, table, tabs, textarea — không có checkbox.tsx
- **Fix:** Dùng native `input[type="checkbox"]` với Tailwind classes — behavior và UX giống hệt, không cần install thêm.
- **Files modified:** components/search/SearchFilters.tsx

## Verification Results

1. `npx tsc --noEmit` — No errors in card/filters
2. `npx tsc --noEmit` — No errors in search page
3. 4 files tạo đúng đường dẫn, commit hashes: 3a0bdca, e5348c6

## Known Stubs

None — tất cả data từ Algolia hits thực tế.

## Self-Check: PASSED
