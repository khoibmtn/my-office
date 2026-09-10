# Smart Recurrence Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate the Smart Recurrence Engine with RFC 5545 `bySetPos` rules, weekend adjustment policies, hybrid triggers (calendar & completion-based), Google Calendar 3-scope mutators, opportunistic background sync, and previous occurrence linkage.

**Architecture:** Modular Task Domain within Next.js 14 + Firestore Monolith. `TaskSeries` defines recurrence blueprints, `tasks` collection holds concrete occurrences with deterministic idempotency keys (`occurrenceKey`). The engine computes dates, clones subtask templates, links previous occurrences, and provides both Server Cron API and Client Opportunistic sync. A scoped dialog handles Google Calendar edit/delete patterns ("Chỉ kỳ này", "Kỳ này và các kỳ sau", "Tất cả các kỳ").

**Tech Stack:** Next.js 14 App Router, TypeScript, Firestore Web SDK, Tailwind CSS, Lucide Icons, Vitest.

---

## File Structure & Responsibilities

| File | Status | Responsibility |
|---|---|---|
| `types/tasks.ts` | Modify | Expand `TaskSeries` and `Task` types with `recurrenceType`, `weekendPolicy`, `bySetPos`, `previousTaskId`, `isDetached` |
| `lib/recurrence/types.ts` | Modify | Update `RecurrenceRule` type with `bySetPos` and `weekendPolicy` |
| `lib/recurrence/generate.ts` | Modify | Implement `resolveBySetPos` and `applyWeekendPolicy` in pure generator |
| `__tests__/recurrence/generate.test.ts` | Modify | Unit tests for `bySetPos`, `weekendPolicy`, and leap year handling |
| `lib/tasks/series.ts` | Modify | Occurrence generator with subtask cloning, previous task linkage, and Google Calendar 3-scope mutator |
| `app/api/cron/recurrence/route.ts` | Create | Server Cron endpoint for Vercel Cron / external scheduler |
| `hooks/useRecurringScheduler.ts` | Create | Client Opportunistic Sync hook (runs background check when user opens app) |
| `app/(app)/layout.tsx` | Modify | Mount `useRecurringScheduler()` globally in authenticated layout |
| `components/tasks/RecurringScopeModal.tsx` | Create | 3-Scope selection dialog (Google Calendar pattern) on edit/delete |
| `components/tasks/SeriesForm.tsx` | Modify | Full UI for Calendar vs After-completion, `bySetPos`, `weekendPolicy`, and subtask templates |
| `components/tasks/TaskDetail.tsx` | Modify | Add "📋 Xem kỳ trước đó" button and integrate `RecurringScopeModal` |
| `components/tasks/TaskEditModal.tsx` | Modify | Pass recurring task scope choice to mutation |
| `app/(app)/tasks/recurring/page.tsx` | Modify | Display smart rules summary badge, status, and occurrence list |

---

## Bite-Sized Implementation Tasks

### Task 1: Domain Types Expansion

**Files:**
- Modify: `types/tasks.ts:115-170`
- Modify: `lib/recurrence/types.ts:1-25`

- [ ] **Step 1: Update `types/tasks.ts` with recurrence types**
  Add `RecurrenceType = 'calendar' | 'after_completion'`, `WeekendPolicy = 'exact' | 'shift_friday' | 'shift_monday'`. Add `recurrenceType`, `completionOffsetDays`, `weekendPolicy`, `previousSeriesId` to `TaskSeries`. Add `isDetached?: boolean`, `previousTaskId?: string | null` to `Task`.

- [ ] **Step 2: Update `lib/recurrence/types.ts`**
  Add `bySetPos?: number`, `weekendPolicy?: 'exact' | 'shift_friday' | 'shift_monday'` to `RecurrenceRule`.

- [ ] **Step 3: Run TypeScript typecheck**
  Run: `npx tsc --noEmit`
  Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**
  ```bash
  git add types/tasks.ts lib/recurrence/types.ts
  git commit -m "feat(tasks): expand domain types for smart recurrence engine"
  ```

---

### Task 2: Advanced Recurrence Algorithm (`bySetPos` & `weekendPolicy`)

**Files:**
- Modify: `lib/recurrence/generate.ts`
- Test: `__tests__/recurrence/generate.test.ts`

- [ ] **Step 1: Write failing tests in `__tests__/recurrence/generate.test.ts`**
  Write tests for:
  1. `bySetPos: 1, byWeekday: [1]` (First Monday of month).
  2. `bySetPos: -1, byWeekday: [5]` (Last Friday of month).
  3. `weekendPolicy: 'shift_friday'` (Saturday shifts to Friday, Sunday shifts to Friday).
  4. `weekendPolicy: 'shift_monday'` (Saturday shifts to Monday, Sunday shifts to Monday).

- [ ] **Step 2: Run tests to verify failure**
  Run: `npx vitest run __tests__/recurrence/generate.test.ts`
  Expected: FAIL with missing `bySetPos` or `weekendPolicy` handling.

- [ ] **Step 3: Implement `resolveBySetPos` and `applyWeekendPolicy` in `lib/recurrence/generate.ts`**
  Implement the functions and integrate into `generateMonthly` and `generateYearly`.

- [ ] **Step 4: Run tests to verify pass**
  Run: `npx vitest run __tests__/recurrence/generate.test.ts`
  Expected: PASS (all tests green).

- [ ] **Step 5: Commit**
  ```bash
  git add lib/recurrence/generate.ts __tests__/recurrence/generate.test.ts
  git commit -m "feat(recurrence): implement bySetPos and weekendPolicy algorithms"
  ```

---

### Task 3: Smart Occurrence Generator with Subtask Cloning & Previous Linkage

**Files:**
- Modify: `lib/tasks/series.ts`

- [ ] **Step 1: Implement subtask template cloning in `generateSeriesOccurrences`**
  When creating occurrence document in batch, iterate `series.defaultSubtasks` and write subtasks to `tasks` collection with `parentTaskId: docId`, `status: 'pending'`, `progress: 0`.

- [ ] **Step 2: Implement previous occurrence lookup (`previousTaskId`)**
  Before writing each occurrence, query the latest occurrence of the series preceding this date and attach `previousTaskId`.

- [ ] **Step 3: Implement `generateNextCompletionOccurrence` for `after_completion`**
  Add helper function to calculate `nextDate = completionDate + completionOffsetDays` and create the next occurrence immediately upon completion.

- [ ] **Step 4: Run unit tests**
  Run: `npx vitest run`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add lib/tasks/series.ts
  git commit -m "feat(tasks): add subtask cloning and previous task linkage in series generator"
  ```

---

### Task 4: Automated Scheduler - Cron API & Client Opportunistic Sync

**Files:**
- Create: `app/api/cron/recurrence/route.ts`
- Create: `hooks/useRecurringScheduler.ts`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Create `app/api/cron/recurrence/route.ts`**
  Export `GET` handler: verifies `CRON_SECRET` if set, queries active series, generates occurrences up to `rollingWindowDays`, returns JSON with count of generated tasks.

- [ ] **Step 2: Create `hooks/useRecurringScheduler.ts`**
  Client hook that executes once per 60 seconds across sessions: queries active series and ensures today's occurrences are generated using `generateSeriesOccurrences` without blocking UI.

- [ ] **Step 3: Mount `useRecurringScheduler` in `app/(app)/layout.tsx`**
  Import and invoke `useRecurringScheduler()` inside the authenticated app shell.

- [ ] **Step 4: Verify typecheck & build**
  Run: `npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add app/api/cron/recurrence/route.ts hooks/useRecurringScheduler.ts app/(app)/layout.tsx
  git commit -m "feat(recurrence): add Cron API route and client opportunistic scheduler"
  ```

---

### Task 5: Google Calendar Scoped Mutator (3-Scope Edit / Delete)

**Files:**
- Create: `components/tasks/RecurringScopeModal.tsx`
- Modify: `lib/tasks/series.ts`
- Modify: `components/tasks/TaskEditModal.tsx`
- Modify: `components/tasks/TaskDetail.tsx`

- [ ] **Step 1: Implement `updateRecurringTaskScoped` in `lib/tasks/series.ts`**
  Support 3 scopes:
  - `'this_only'`: update task doc, set `isDetached = true`.
  - `'this_and_future'`: set `oldSeries.endDate = prevDay`, create `newSeries` starting at this date with `previousSeriesId = oldSeries.id`, update future occurrences.
  - `'all'`: update `TaskSeries`, batch update unclosed non-detached tasks.

- [ ] **Step 2: Create `components/tasks/RecurringScopeModal.tsx`**
  Modal dialog with 3 radio choices ("Chỉ công việc kỳ này", "Công việc này và tất cả các kỳ tiếp theo", "Tất cả các công việc trong chuỗi") styled with clear descriptive subtitles and Confirm/Cancel buttons.

- [ ] **Step 3: Integrate `RecurringScopeModal` into `TaskEditModal.tsx` and `TaskDetail.tsx`**
  When editing or cancelling a recurring task (`task.seriesId != null`), prompt user with scope modal before committing mutations.

- [ ] **Step 4: Typecheck and test**
  Run: `npx tsc --noEmit && npx vitest run`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add components/tasks/RecurringScopeModal.tsx lib/tasks/series.ts components/tasks/TaskEditModal.tsx components/tasks/TaskDetail.tsx
  git commit -m "feat(tasks): implement Google Calendar 3-scope edit and delete dialog"
  ```

---

### Task 6: Enhanced Series Configuration Form (`SeriesForm.tsx`)

**Files:**
- Modify: `components/tasks/SeriesForm.tsx`
- Modify: `app/(app)/tasks/recurring/page.tsx`

- [ ] **Step 1: Add Recurrence Type selector (Calendar vs After-completion)**
  In `SeriesForm.tsx`, add tabs `[ Theo lịch cố định ]` and `[ Sau khi hoàn thành ]`. If `after_completion`, show input `completionOffsetDays` ("Lặp lại sau N ngày kể từ khi kỳ trước hoàn thành").

- [ ] **Step 2: Add `bySetPos` and `weekendPolicy` selectors**
  Under monthly options, add "Thứ X trong tháng" selector (Đầu tiên, Thứ hai, Thứ ba, Thứ tư, Cuối cùng). Add Weekend Policy selector ("Giữ đúng ngày", "Lùi về Thứ Sáu", "Dời sang Thứ Hai").

- [ ] **Step 3: Add Subtask Template Builder**
  Allow adding/removing checklist items to `defaultSubtasks` so each new occurrence automatically gets these subtasks.

- [ ] **Step 4: Test in browser**
  Create a series with bySetPos ("Thứ Hai đầu tháng") and weekend policy. Verify form submits cleanly.

- [ ] **Step 5: Commit**
  ```bash
  git add components/tasks/SeriesForm.tsx app/(app)/tasks/recurring/page.tsx
  git commit -m "feat(recurrence): enhance SeriesForm with hybrid types, bySetPos, and weekend policy"
  ```

---

### Task 7: Occurrence Detail UI Enhancement ("Xem kỳ trước đó")

**Files:**
- Modify: `components/tasks/TaskDetail.tsx`

- [ ] **Step 1: Add "📋 Xem kỳ trước đó" button**
  In `TaskDetail.tsx`, if `task.previousTaskId` exists, render a prominent button in header/meta: "📋 Xem kỳ trước đó" linking directly to `/tasks/${task.previousTaskId}`.

- [ ] **Step 2: Add recurring series badge**
  Render badge `🔁 Chuỗi định kỳ: [Tên chuỗi]` with link back to `/tasks/recurring`.

- [ ] **Step 3: Hook completion trigger for `after_completion`**
  When completing a task where `series.recurrenceType === 'after_completion'`, invoke `generateNextCompletionOccurrence`.

- [ ] **Step 4: Typecheck and test**
  Run: `npx tsc --noEmit && npx vitest run`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add components/tasks/TaskDetail.tsx
  git commit -m "feat(tasks): add previous occurrence link and completion trigger in TaskDetail"
  ```

---

### Task 8: Full Verification & Walkthrough

- [ ] **Step 1: Run full test suite**
  Run: `npx vitest run`
  Expected: All tests pass.

- [ ] **Step 2: Run TypeScript compile check**
  Run: `npx tsc --noEmit`
  Expected: 0 errors.

- [ ] **Step 3: Test complete workflows in browser**
  - Create Calendar-based series with bySetPos ("Thứ Hai đầu tháng") and Weekend policy.
  - Create Completion-based series ("Lặp lại sau 3 ngày hoàn thành"). Complete the task and verify next occurrence spawns.
  - Edit a recurring task occurrence and verify 3-scope Google Calendar modal.
  - Open generated task and verify subtask checklist is cloned and "📋 Xem kỳ trước đó" links correctly.

- [ ] **Step 4: Update Walkthrough & Final Commit**
