---
phase: 02-search-dashboard
plan: "01"
subsystem: search
tags: [algolia, search, sync, hooks]
dependency_graph:
  requires: []
  provides: [algolia-client, algolia-server-sync, useSearch-hook]
  affects: [app/api/drive/copy/route.ts, lib/firestore.ts]
tech_stack:
  added: [algoliasearch@^5]
  patterns: [fire-and-forget sync, debounced hook, server-only guard]
key_files:
  created:
    - lib/algolia.ts
    - lib/algolia-server.ts
    - hooks/useSearch.ts
  modified:
    - app/api/drive/copy/route.ts
    - lib/firestore.ts
decisions:
  - algolia v5 liteClient uses client.search({requests:[...]}) not initIndex — updated call signatures accordingly
  - docId passed in fetch body from firestore.ts so API route can trigger syncAfterDriveUpdate
  - syncAfterDriveUpdate reads full doc from Firestore server-side to build complete Algolia record
metrics:
  duration: ~12 minutes
  completed: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
status: complete
---

# Phase 2 Plan 01: Algolia Integration Layer Summary

Algolia integration foundation — liteClient search helper, server-only admin sync with fire-and-forget injection, and debounced useSearch hook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Algolia client + server helpers | 4fd0751 | lib/algolia.ts, lib/algolia-server.ts |
| 2 | Inject Algolia sync into drive copy route | 7f4f6aa | app/api/drive/copy/route.ts, lib/firestore.ts |
| 3 | useSearch hook | 7e4aeff | hooks/useSearch.ts |

## What Was Built

**lib/algolia.ts** — Memoized `liteClient` wrapper. Exports `searchClient()` and `INDEX_NAME`. Uses `NEXT_PUBLIC_ALGOLIA_APP_ID` + `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` only.

**lib/algolia-server.ts** — `import 'server-only'` at top prevents accidental client bundle inclusion. Exports:
- `syncToAlgolia(docId, doc)` — `saveObject` with missing-env guard (logs warning, no throw)
- `partialUpdateAlgoliaStatus(docId, status)` — `partialUpdateObject` for status-only updates
- `syncAfterDriveUpdate(docId)` — reads full doc from Firestore then calls `syncToAlgolia`, used by API route

**app/api/drive/copy/route.ts** — Added `docId` extraction from request body + `void syncAfterDriveUpdate(docId)` fire-and-forget after Drive copy succeeds.

**lib/firestore.ts** — Added `docId` to fetch body so API route receives it.

**hooks/useSearch.ts** — 300ms debounce, empty query guard, `SearchFilters` → Algolia filter string conversion, returns `{ hits: AlgoliaHit[], loading: boolean }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] algoliasearch v5 API breaking changes**
- **Found during:** Task 1 + Task 3
- **Issue:** Plan referenced `initIndex()` (v4 API) and `searchSingleIndex()` — both removed in v5. `liteClient` only exposes `search({requests:[...]})`.
- **Fix:** Used `client.search({requests:[{indexName, query, filters}]})` for hook; `client.saveObject({indexName, body})` / `client.partialUpdateObject({indexName, objectID, attributesToUpdate})` for server sync.
- **Files modified:** lib/algolia.ts, lib/algolia-server.ts, hooks/useSearch.ts

**2. [Rule 2 - Missing] docId not passed in fetch body**
- **Found during:** Task 2
- **Issue:** `submitDocumentWithDriveCopy` in `firestore.ts` didn't include `docId` in the request body, so the API route couldn't identify which document to sync.
- **Fix:** Added `docId` to fetch body in `firestore.ts`; extracted in route handler.
- **Files modified:** lib/firestore.ts, app/api/drive/copy/route.ts

## Verification Results

1. `npx tsc --noEmit` — exit 0, zero errors
2. `ALGOLIA_ADMIN_KEY` absent from `lib/algolia.ts` and `hooks/` — PASS
3. `import 'server-only'` in `lib/algolia-server.ts` — PASS
4. `syncAfterDriveUpdate` present in `app/api/drive/copy/route.ts` — PASS
5. `void syncAfterDriveUpdate(docId)` (not awaited) — PASS

## Self-Check: PASSED
