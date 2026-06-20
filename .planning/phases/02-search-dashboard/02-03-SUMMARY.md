---
phase: 02-search-dashboard
plan: "03"
subsystem: dashboard
status: complete
tags: [dashboard, firestore, realtime, onSnapshot]
dependency_graph:
  requires: [02-01]
  provides: [dashboard-page, stats-grid, deadline-timeline]
  affects: [app/(app)/page.tsx]
tech_stack:
  added: []
  patterns: [onSnapshot-realtime, client-component-hooks]
key_files:
  created:
    - hooks/useDeadlineDocuments.ts
    - components/dashboard/StatsGrid.tsx
    - components/dashboard/DeadlineTimeline.tsx
    - app/(app)/page.tsx
    - firestore.indexes.json
  modified: []
decisions:
  - "DeadlineTimeline dùng relative time ('còn N ngày') — rõ hơn absolute date cho deadline urgency"
  - "StatsGrid nhận documents[] prop từ useDocuments() trong page.tsx — tránh double subscription"
  - "DeadlineTimeline gọi useDeadlineDocuments() trực tiếp — tách biệt query range khỏi full list"
metrics:
  duration: "~7 phút"
  completed: "2026-06-20"
  tasks_completed: 2
  files_created: 5
---

# Phase 2 Plan 03: Dashboard Summary

Dashboard trang chủ với StatsGrid (3 stat cards) và DeadlineTimeline (7 ngày tới), realtime qua Firestore onSnapshot.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useDeadlineDocuments hook + Firestore index | 55bcdb2 | hooks/useDeadlineDocuments.ts, firestore.indexes.json |
| 2 | StatsGrid + DeadlineTimeline + Dashboard page | 1263349 | components/dashboard/StatsGrid.tsx, components/dashboard/DeadlineTimeline.tsx, app/(app)/page.tsx |

## What Was Built

- `hooks/useDeadlineDocuments.ts` — Firestore onSnapshot query: deadline trong [now, now+7d], orderBy asc, limit(10). Pattern mirrors useDocuments.ts.
- `components/dashboard/StatsGrid.tsx` — 3 shadcn Card: Tổng văn bản, Đang xử lý (pending+in_progress), Quá hạn (text-red-600 nếu >0).
- `components/dashboard/DeadlineTimeline.tsx` — list deadline 7 ngày tới, relative time coloring (<=1d: red, <=3d: orange), skeleton loading, empty state.
- `app/(app)/page.tsx` — client Dashboard page: useDocuments → StatsGrid, DeadlineTimeline standalone.
- `firestore.indexes.json` — composite index deadline ASC để satisfy range query + orderBy.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` — zero errors
- firestore.indexes.json: deadline index present
- T-02-07 mitigated: limit(10) on useDeadlineDocuments query

## Self-Check: PASSED

- hooks/useDeadlineDocuments.ts: FOUND
- components/dashboard/StatsGrid.tsx: FOUND
- components/dashboard/DeadlineTimeline.tsx: FOUND
- app/(app)/page.tsx: FOUND
- firestore.indexes.json: FOUND
- commit 55bcdb2: FOUND
- commit 1263349: FOUND
