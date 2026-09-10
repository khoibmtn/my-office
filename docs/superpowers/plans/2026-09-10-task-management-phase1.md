# Task Management Engine — Phase 1: Task Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational Task CRUD, assignment, status management, comments, Department entity, Staff migration, and server-side mutation infrastructure for the Task Management Engine.

**Architecture:** Integrated Modular Monolith within existing Next.js App Router + Firestore codebase. Server-side mutations via Cloud Functions callable for atomic Task + Activity + Outbox writes. New `modules/tasks/` folder structure with pure business logic in `lib/`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Firestore, Cloud Functions (callable), Tailwind CSS, Radix UI, Lucide icons, Vitest

**Spec:** `docs/superpowers/specs/2026-09-10-task-management-design.md`

---

## File Structure Overview

### New Files to Create

```
# Domain Types
types/tasks.ts                              # Task, TaskSeries, TaskComment, TaskActivity, etc.
types/departments.ts                        # Department, TaskStats, Notification types

# Pure Business Logic (no React/Firestore deps)
lib/tasks/validation.ts                     # State machine transitions, dependency cycle check
lib/tasks/progress.ts                       # Progress calculation (manual/subtask)
lib/tasks/permissions.ts                    # RBAC check functions for task operations
lib/tasks/constants.ts                      # Enums, defaults, status labels

# Firestore Data Layer
lib/tasks/firestore.ts                      # Firestore CRUD: read tasks, query patterns
lib/tasks/mutations.ts                      # Client-side callable wrappers (call CF)
lib/departments.ts                          # Department CRUD

# React Hooks
hooks/useTasks.ts                           # Real-time task subscription, My Tasks query
hooks/useTaskDetail.ts                      # Single task + comments + activities
hooks/useDepartments.ts                     # Department list subscription
hooks/useTaskStats.ts                       # TaskStats counters subscription

# Cloud Functions (server-side)
functions/                                  # New directory for Cloud Functions project
functions/package.json
functions/tsconfig.json
functions/src/index.ts                      # CF entry point
functions/src/taskMutations.ts              # Callable: create, update, assign, status change
functions/src/taskNotifications.ts          # onDocumentCreated for outbox processing
functions/src/taskMaintenance.ts            # Stats counter maintenance

# UI Components
components/tasks/TaskTable.tsx              # Task list table (reuse DocumentTable patterns)
components/tasks/TaskCard.tsx               # Kanban card / list card
components/tasks/TaskForm.tsx               # Create/Edit task form
components/tasks/TaskDetail.tsx             # Task detail split view
components/tasks/TaskCommentThread.tsx      # Comment thread with @mentions
components/tasks/TaskActivityFeed.tsx       # Activity timeline
components/tasks/TaskStatusBadge.tsx        # Status + priority badges
components/tasks/TaskFilters.tsx            # Filter bar (status, assignee, dept, tag)
components/tasks/SubtaskList.tsx            # Subtask list with progress bar

# Pages
app/(app)/tasks/page.tsx                    # My Tasks (default view)
app/(app)/tasks/all/page.tsx                # All Tasks
app/(app)/tasks/[id]/page.tsx               # Task detail page

# Tests
__tests__/tasks/validation.test.ts          # State machine, cycle check tests
__tests__/tasks/progress.test.ts            # Progress calculation tests
__tests__/tasks/permissions.test.ts         # RBAC tests

# Firestore Config
firestore.indexes.json                      # Updated with task indexes
```

### Files to Modify

```
types/index.ts                              # Add StaffMember.departmentIds, etc.
hooks/usePermissions.ts                     # Add task permission checks
lib/staff.ts                                # Add departmentId support
app/(app)/layout.tsx                        # Add Tasks nav items to sidebar
components/dossiers/DossierPanel.tsx         # (Phase 4) Swap checklist for task query
```

---

## Task 1: Domain Types & Constants

**Files:**
- Create: `types/tasks.ts`
- Create: `types/departments.ts`
- Create: `lib/tasks/constants.ts`
- Test: `__tests__/tasks/validation.test.ts` (partial — type smoke tests)

- [ ] **Step 1: Create task type definitions**

Create `types/tasks.ts`:

```typescript
import { Timestamp } from 'firebase/firestore'

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskType = 'single' | 'occurrence'
export type ProgressMode = 'manual' | 'subtask'
export type BlockedReason = 'dependency' | 'manual'
export type TaskSource = 'manual' | 'recurring' | 'template' | 'dossier_checklist' | 'document' | 'system'

export interface Task {
  id: string
  taskCode: string | null
  title: string
  description: string | null

  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  progress: number
  progressMode: ProgressMode
  isClosed: boolean

  startDate: Timestamp | null
  dueDate: Timestamp | null
  completedAt: Timestamp | null
  estimatedMinutes: number | null
  occurrenceDate: Timestamp | null
  visibleFrom: Timestamp | null

  createdBy: string
  assigneeId: string | null
  assigneeName: string | null
  collaboratorIds: string[]
  followerIds: string[]

  departmentId: string | null
  cooperatingDepartmentIds: string[]
  assigneeDepartmentId: string | null

  blockedReason: BlockedReason | null
  blockedByTaskIds: string[]
  blockedNote: string | null
  previousStatus: TaskStatus | null

  dossierIds: string[]
  documentIds: string[]
  parentTaskId: string | null
  dependsOnTaskIds: string[]
  relatedTaskIds: string[]

  seriesId: string | null
  occurrenceKey: string | null

  templateId: string | null

  tagIds: string[]
  attachments: import('./index').Attachment[]
  source: TaskSource

  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
  migratedFromChecklistId: string | null
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  authorName: string
  content: string
  mentions: string[]
  attachments: import('./index').Attachment[]
  deletedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface TaskActivity {
  id: string
  taskId: string
  actorId: string
  actorName: string
  eventType: ActivityEventType
  metadata: Record<string, any>
  createdAt: Timestamp
}

export type ActivityEventType =
  | 'CREATED' | 'ASSIGNED' | 'REASSIGNED' | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED' | 'DEADLINE_CHANGED' | 'PROGRESS_UPDATED'
  | 'COMMENT_ADDED' | 'ATTACHMENT_ADDED' | 'COMPLETED' | 'REOPENED'
  | 'BLOCKED' | 'UNBLOCKED' | 'SUBTASK_COMPLETED' | 'DEPENDENCY_ADDED'

export interface NotificationEvent {
  id: string
  eventType: string
  entityType: 'task' | 'document' | 'dossier'
  entityId: string
  actorId: string
  recipientIds: string[]
  payload: Record<string, any>
  processingStatus: 'pending' | 'processing' | 'processed' | 'failed'
  processedAt: Timestamp | null
  retryCount: number
  createdAt: Timestamp
}

export interface TaskStats {
  id: string
  scope: 'user' | 'department' | 'global'
  scopeId: string
  pending: number
  inProgress: number
  blocked: number
  completed: number
  cancelled: number
  overdue: number
  completedThisWeek: number
  completedThisMonth: number
  updatedAt: Timestamp
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: TaskPriority
  startDate?: Timestamp
  dueDate?: Timestamp
  assigneeId?: string
  collaboratorIds?: string[]
  followerIds?: string[]
  departmentId?: string
  dossierIds?: string[]
  documentIds?: string[]
  parentTaskId?: string
  tagIds?: string[]
  source?: TaskSource
}
```

- [ ] **Step 2: Create department types**

Create `types/departments.ts`:

```typescript
import { Timestamp } from 'firebase/firestore'

export type DepartmentType = 'chức_năng' | 'lâm_sàng' | 'cận_lâm_sàng' | 'ban_giám_đốc'

export interface Department {
  id: string
  name: string
  code: string
  type: DepartmentType
  parentId: string | null
  headStaffId: string | null
  deputyStaffIds: string[]
  order: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

- [ ] **Step 3: Create constants file**

Create `lib/tasks/constants.ts`:

```typescript
import type { TaskStatus, TaskPriority } from '@/types/tasks'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang thực hiện',
  blocked: 'Bị chặn',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  blocked: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
  urgent: 'Khẩn cấp',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-600' },
  normal: { bg: 'bg-blue-100', text: 'text-blue-600' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
}

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'blocked', 'cancelled'],
  blocked: ['pending', 'in_progress', 'cancelled'],
  completed: ['pending'],
  cancelled: ['pending'],
}

export const CLOSED_STATUSES: TaskStatus[] = ['completed', 'cancelled']
```

- [ ] **Step 4: Commit types and constants**

```bash
git add types/tasks.ts types/departments.ts lib/tasks/constants.ts
git commit -m "feat(tasks): add domain types, department types, and task constants"
```

---

## Task 2: Pure Business Logic — Validation & State Machine

**Files:**
- Create: `lib/tasks/validation.ts`
- Test: `__tests__/tasks/validation.test.ts`

- [ ] **Step 1: Write failing tests for state machine validation**

Create `__tests__/tasks/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  isValidTransition,
  validateStatusChange,
  detectDependencyCycle,
  computeIsClosed,
} from '@/lib/tasks/validation'

describe('Task State Machine', () => {
  it('allows PENDING → IN_PROGRESS', () => {
    expect(isValidTransition('pending', 'in_progress')).toBe(true)
  })

  it('blocks IN_PROGRESS → PENDING (invalid)', () => {
    expect(isValidTransition('in_progress', 'pending')).toBe(false)
  })

  it('allows COMPLETED → PENDING (reopen)', () => {
    expect(isValidTransition('completed', 'pending')).toBe(true)
  })

  it('blocks COMPLETED → IN_PROGRESS (must reopen first)', () => {
    expect(isValidTransition('completed', 'in_progress')).toBe(false)
  })

  it('allows any status → CANCELLED', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true)
    expect(isValidTransition('in_progress', 'cancelled')).toBe(true)
    expect(isValidTransition('blocked', 'cancelled')).toBe(true)
  })
})

describe('isClosed', () => {
  it('returns true for completed', () => {
    expect(computeIsClosed('completed')).toBe(true)
  })
  it('returns true for cancelled', () => {
    expect(computeIsClosed('cancelled')).toBe(true)
  })
  it('returns false for pending/in_progress/blocked', () => {
    expect(computeIsClosed('pending')).toBe(false)
    expect(computeIsClosed('in_progress')).toBe(false)
    expect(computeIsClosed('blocked')).toBe(false)
  })
})

describe('Dependency Cycle Detection', () => {
  it('detects simple A→B→A cycle', () => {
    const graph = { A: ['B'], B: ['A'] }
    expect(detectDependencyCycle('A', 'B', graph)).toBe(true)
  })

  it('detects transitive A→B→C→A cycle', () => {
    const graph = { A: ['B'], B: ['C'], C: [] }
    // Adding C→A would create cycle
    expect(detectDependencyCycle('C', 'A', graph)).toBe(true)
  })

  it('allows non-cyclic dependency', () => {
    const graph = { A: [], B: ['A'], C: [] }
    expect(detectDependencyCycle('C', 'A', graph)).toBe(false)
  })

  it('handles empty graph', () => {
    const graph = {}
    expect(detectDependencyCycle('A', 'B', graph)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/tasks/validation.test.ts
```
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement validation module**

Create `lib/tasks/validation.ts`:

```typescript
import type { TaskStatus } from '@/types/tasks'
import { VALID_TRANSITIONS, CLOSED_STATUSES } from './constants'

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function computeIsClosed(status: TaskStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

export function validateStatusChange(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  hasIncompleteSubtasks: boolean = false
): { valid: boolean; error?: string } {
  if (!isValidTransition(currentStatus, newStatus)) {
    return { valid: false, error: `Không thể chuyển từ "${currentStatus}" sang "${newStatus}"` }
  }
  if (newStatus === 'completed' && hasIncompleteSubtasks) {
    return { valid: false, error: 'Không thể hoàn thành khi còn subtask chưa xong' }
  }
  return { valid: true }
}

/**
 * Detect if adding dependency (fromTask → toTask) would create a cycle.
 * Uses DFS: checks if toTask can reach fromTask via existing dependencies.
 *
 * @param fromTask - Task that would DEPEND ON toTask
 * @param toTask - Task being added as dependency
 * @param graph - adjacency list: taskId → dependsOnTaskIds[]
 * @returns true if cycle would be created
 */
export function detectDependencyCycle(
  fromTask: string,
  toTask: string,
  graph: Record<string, string[]>
): boolean {
  // If adding fromTask depends on toTask,
  // check if toTask can reach fromTask (cycle exists)
  const visited = new Set<string>()

  function dfs(current: string): boolean {
    if (current === fromTask) return true
    if (visited.has(current)) return false
    visited.add(current)
    const deps = graph[current] ?? []
    return deps.some(dep => dfs(dep))
  }

  return dfs(toTask)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/tasks/validation.test.ts
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/validation.ts __tests__/tasks/validation.test.ts
git commit -m "feat(tasks): add state machine validation with cycle detection (TDD)"
```

---

## Task 3: Pure Business Logic — Progress Calculation

**Files:**
- Create: `lib/tasks/progress.ts`
- Test: `__tests__/tasks/progress.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/tasks/progress.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateSubtaskProgress, computeDerivedStates } from '@/lib/tasks/progress'

describe('Subtask Progress', () => {
  it('returns 0 for no subtasks', () => {
    expect(calculateSubtaskProgress([])).toBe(0)
  })

  it('calculates correct percentage', () => {
    const subtasks = [
      { status: 'completed' as const, isClosed: true },
      { status: 'completed' as const, isClosed: true },
      { status: 'pending' as const, isClosed: false },
    ]
    expect(calculateSubtaskProgress(subtasks)).toBe(67)
  })

  it('returns 100 when all completed', () => {
    const subtasks = [
      { status: 'completed' as const, isClosed: true },
      { status: 'completed' as const, isClosed: true },
    ]
    expect(calculateSubtaskProgress(subtasks)).toBe(100)
  })
})

describe('Derived States', () => {
  it('detects OVERDUE', () => {
    const yesterday = new Date(Date.now() - 86400000)
    const states = computeDerivedStates({
      dueDate: yesterday,
      isClosed: false,
      progress: 50,
      visibleFrom: null,
    })
    expect(states).toContain('OVERDUE')
  })

  it('does not flag closed task as OVERDUE', () => {
    const yesterday = new Date(Date.now() - 86400000)
    const states = computeDerivedStates({
      dueDate: yesterday,
      isClosed: true,
      progress: 100,
      visibleFrom: null,
    })
    expect(states).not.toContain('OVERDUE')
  })

  it('detects AT_RISK', () => {
    const tomorrow = new Date(Date.now() + 86400000)
    const states = computeDerivedStates({
      dueDate: tomorrow,
      isClosed: false,
      progress: 30,
      visibleFrom: null,
    })
    expect(states).toContain('AT_RISK')
  })

  it('detects UPCOMING', () => {
    const nextWeek = new Date(Date.now() + 7 * 86400000)
    const states = computeDerivedStates({
      dueDate: null,
      isClosed: false,
      progress: 0,
      visibleFrom: nextWeek,
    })
    expect(states).toContain('UPCOMING')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run __tests__/tasks/progress.test.ts
```

- [ ] **Step 3: Implement progress module**

Create `lib/tasks/progress.ts`:

```typescript
export type DerivedState = 'OVERDUE' | 'AT_RISK' | 'UPCOMING'

interface SubtaskForProgress {
  status: string
  isClosed: boolean
}

export function calculateSubtaskProgress(subtasks: SubtaskForProgress[]): number {
  if (subtasks.length === 0) return 0
  const completed = subtasks.filter(s => s.isClosed).length
  return Math.round((completed / subtasks.length) * 100)
}

interface DerivedStateInput {
  dueDate: Date | null
  isClosed: boolean
  progress: number
  visibleFrom: Date | null
}

export function computeDerivedStates(input: DerivedStateInput): DerivedState[] {
  const states: DerivedState[] = []
  const now = new Date()

  if (input.visibleFrom && input.visibleFrom > now) {
    states.push('UPCOMING')
  }

  if (input.dueDate && !input.isClosed) {
    const msLeft = input.dueDate.getTime() - now.getTime()
    const daysLeft = msLeft / (1000 * 60 * 60 * 24)

    if (daysLeft < 0) {
      states.push('OVERDUE')
    } else if (daysLeft <= 2 && input.progress < 80) {
      states.push('AT_RISK')
    }
  }

  return states
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/tasks/progress.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/progress.ts __tests__/tasks/progress.test.ts
git commit -m "feat(tasks): add progress calculation and derived states (TDD)"
```

---

## Task 4: Pure Business Logic — RBAC Permissions

**Files:**
- Create: `lib/tasks/permissions.ts`
- Test: `__tests__/tasks/permissions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/tasks/permissions.test.ts` with tests for `canViewTask`, `canEditTask`, `canDeleteTask`, `canChangeStatus`, `canAddComment`. Cover admin override, creator rights, assignee rights, collaborator read-only, follower view-only, cross-department block.

- [ ] **Step 2: Run tests — expect FAIL**
- [ ] **Step 3: Implement permissions module**

Create `lib/tasks/permissions.ts` implementing the RBAC matrix from spec Section 6.

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add lib/tasks/permissions.ts __tests__/tasks/permissions.test.ts
git commit -m "feat(tasks): add RBAC permission checks (TDD)"
```

---

## Task 5: Staff & Department Schema Migration

**Files:**
- Modify: `types/index.ts` — add `primaryDepartmentId`, `departmentIds`, `managerId` to `StaffMember`
- Create: `lib/departments.ts` — Department CRUD
- Create: `hooks/useDepartments.ts` — Real-time department subscription
- Modify: `lib/staff.ts` — add departmentId support to staff queries

- [ ] **Step 1: Add department fields to StaffMember type**

In `types/index.ts`, add to `StaffMember`:

```typescript
primaryDepartmentId?: string | null
departmentIds?: string[]
managerId?: string | null
```

- [ ] **Step 2: Create `lib/departments.ts`**

Implement `getDepartments()`, `createDepartment()`, `updateDepartment()` using Firestore patterns from `lib/tags.ts`.

- [ ] **Step 3: Create `hooks/useDepartments.ts`**

Real-time subscription to `/departments` collection ordered by `order`, following pattern from `hooks/useTags.ts`.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/departments.ts hooks/useDepartments.ts lib/staff.ts
git commit -m "feat(departments): add department entity and staff department fields"
```

---

## Task 6: Firestore Task Data Layer

**Files:**
- Create: `lib/tasks/firestore.ts` — Task queries (read-only, client-side)
- Create: `lib/tasks/mutations.ts` — Client callable wrappers
- Create: `hooks/useTasks.ts` — Real-time task subscription
- Create: `hooks/useTaskDetail.ts` — Single task + comments + activities
- Modify: `firestore.indexes.json` — Add all task indexes

- [ ] **Step 1: Create `lib/tasks/firestore.ts`**

Implement read-only queries following patterns from `lib/firestore.ts`:

```typescript
// Query patterns from spec Section B3:
export function queryMyTasks(assigneeId: string): Query
export function queryDepartmentTasks(departmentId: string): Query
export function queryDossierTasks(dossierId: string): Query
export function querySubtasks(parentTaskId: string): Query
export function queryTaskComments(taskId: string): Query
export function queryTaskActivities(taskId: string): Query
```

- [ ] **Step 2: Create `lib/tasks/mutations.ts`**

Client wrappers that call Cloud Functions (to be built in Task 7):

```typescript
export async function createTask(input: CreateTaskInput): Promise<string>
export async function updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void>
export async function assignTask(taskId: string, assigneeId: string): Promise<void>
export async function addTaskComment(taskId: string, content: string, mentions?: string[]): Promise<void>
export async function deleteTask(taskId: string): Promise<void>
```

- [ ] **Step 3: Create `hooks/useTasks.ts`**

Real-time subscription with Firestore `onSnapshot`, following `hooks/useDocuments.ts` pattern.

- [ ] **Step 4: Create `hooks/useTaskDetail.ts`**

Subscribe to single task doc + taskComments + taskActivities.

- [ ] **Step 5: Update `firestore.indexes.json`**

Add all 15 composite indexes from spec Section B3.

- [ ] **Step 6: Commit**

```bash
git add lib/tasks/firestore.ts lib/tasks/mutations.ts hooks/useTasks.ts hooks/useTaskDetail.ts firestore.indexes.json
git commit -m "feat(tasks): add Firestore data layer, hooks, and indexes"
```

---

## Task 7: Cloud Functions — Server-Side Mutations

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/index.ts`
- Create: `functions/src/taskMutations.ts`
- Create: `functions/src/taskNotifications.ts`
- Create: `functions/src/taskMaintenance.ts`

- [ ] **Step 1: Initialize Cloud Functions project**

```bash
mkdir -p functions/src
```

Create `functions/package.json` with `firebase-functions`, `firebase-admin` dependencies.

- [ ] **Step 2: Create `functions/src/taskMutations.ts`**

Implement callable Cloud Functions:

```typescript
// onCall: createTask
//   → validate RBAC
//   → WriteBatch: create /tasks + /taskActivities (CREATED) + /notificationEvents (TASK_ASSIGNED if assignee)
//   → increment /taskStats

// onCall: updateTask
//   → validate RBAC + state machine
//   → WriteBatch: update /tasks + /taskActivities + /notificationEvents
//   → adjust /taskStats deltas

// onCall: deleteTask
//   → validate RBAC
//   → soft delete: tasks.deletedAt = serverTimestamp()
//   → CF onUpdate trigger handles cleanup
```

- [ ] **Step 3: Create `functions/src/taskNotifications.ts`**

Implement outbox processing:

```typescript
// onDocumentCreated("/notificationEvents/{eventId}")
//   → Read event
//   → processingStatus = "processing"
//   → Classify: immediate / scheduled / digest
//   → Create /notifications for each recipientId
//   → processingStatus = "processed"
```

- [ ] **Step 4: Create `functions/src/taskMaintenance.ts`**

```typescript
// onDocumentWrite("/tasks/{taskId}")
//   → If subtask status changed: recalc parent.progress (idempotent transaction)
//   → If task soft-deleted: async chunked cleanup of comments/activities
//   → Update /taskStats counters (FieldValue.increment delta)
```

- [ ] **Step 5: Create `functions/src/index.ts`** — export all functions

- [ ] **Step 6: Commit**

```bash
git add functions/
git commit -m "feat(tasks): add Cloud Functions for server-side mutations, notifications, and maintenance"
```

---

## Task 8: UI Components — Status Badge & Filters

**Files:**
- Create: `components/tasks/TaskStatusBadge.tsx`
- Create: `components/tasks/TaskPriorityBadge.tsx`
- Create: `components/tasks/TaskFilters.tsx`

- [ ] **Step 1: Create `TaskStatusBadge.tsx`**

Reusable badge showing status with color coding and derived states (OVERDUE, AT_RISK). Follow design system: Slate base, semantic colors.

- [ ] **Step 2: Create `TaskPriorityBadge.tsx`**

Priority indicator with urgency colors.

- [ ] **Step 3: Create `TaskFilters.tsx`**

Filter bar with: Status dropdown, Assignee picker (reuse existing staff picker), Department filter, Priority filter, Tag filter.

- [ ] **Step 4: Commit**

```bash
git add components/tasks/TaskStatusBadge.tsx components/tasks/TaskPriorityBadge.tsx components/tasks/TaskFilters.tsx
git commit -m "feat(tasks): add status/priority badges and filter components"
```

---

## Task 9: UI Components — Task Table & Cards

**Files:**
- Create: `components/tasks/TaskTable.tsx`
- Create: `components/tasks/TaskCard.tsx`

- [ ] **Step 1: Create `TaskTable.tsx`**

Table view following `DocumentTable` patterns: columns for Title, Status, Priority, Assignee, Due Date, Department, Progress. Checkbox selection for bulk operations. Row click → navigate to detail.

- [ ] **Step 2: Create `TaskCard.tsx`**

Card for Kanban/list view: Title, status badge, priority, assignee avatar, due date countdown, progress bar.

- [ ] **Step 3: Commit**

```bash
git add components/tasks/TaskTable.tsx components/tasks/TaskCard.tsx
git commit -m "feat(tasks): add task table and card components"
```

---

## Task 10: UI Components — Task Form & Subtask List

**Files:**
- Create: `components/tasks/TaskForm.tsx`
- Create: `components/tasks/SubtaskList.tsx`

- [ ] **Step 1: Create `TaskForm.tsx`**

Create/edit form: Title, Description, Priority, DueDate, Assignee (staff picker), Collaborators (multi-select), Department, Dossier picker (reuse existing), Document picker, Tags. Compact layout following edit page redesign patterns.

- [ ] **Step 2: Create `SubtaskList.tsx`**

Subtask list with: Add input + Enter key, Checkbox toggle, Progress bar (X/Y completed — Z%), Inline edit, Reorder arrows. Follow `DossierChecklist` patterns but using Task entities.

- [ ] **Step 3: Commit**

```bash
git add components/tasks/TaskForm.tsx components/tasks/SubtaskList.tsx
git commit -m "feat(tasks): add task form and subtask list components"
```

---

## Task 11: UI Components — Comment Thread & Activity Feed

**Files:**
- Create: `components/tasks/TaskCommentThread.tsx`
- Create: `components/tasks/TaskActivityFeed.tsx`

- [ ] **Step 1: Create `TaskCommentThread.tsx`**

Chat-style comment thread following `DossierComment` design: bubbles, timestamps, @mention autocomplete, Enter to send, Shift+Enter for newline. Colors: Indigo accent.

- [ ] **Step 2: Create `TaskActivityFeed.tsx`**

Timeline of task activities: icon per event type, actor name, timestamp, metadata display (e.g., "Khôi đã giao cho Đức", "Trạng thái: Chờ xử lý → Đang thực hiện").

- [ ] **Step 3: Commit**

```bash
git add components/tasks/TaskCommentThread.tsx components/tasks/TaskActivityFeed.tsx
git commit -m "feat(tasks): add comment thread and activity feed components"
```

---

## Task 12: UI Components — Task Detail Page

**Files:**
- Create: `components/tasks/TaskDetail.tsx`
- Create: `app/(app)/tasks/[id]/page.tsx`

- [ ] **Step 1: Create `TaskDetail.tsx`**

Split view layout (like Document modal):
- **Left panel**: Task info form (inline-editable), Subtask list, Relations (linked documents/dossiers), Activity feed
- **Right panel**: Comment thread (sticky)

Header: Title, Status badge, Priority badge, Action buttons (Complete, Block, Cancel, Delete).

- [ ] **Step 2: Create `app/(app)/tasks/[id]/page.tsx`**

Route page wrapping `TaskDetail` with `useTaskDetail` hook.

- [ ] **Step 3: Commit**

```bash
git add components/tasks/TaskDetail.tsx app/(app)/tasks/[id]/page.tsx
git commit -m "feat(tasks): add task detail page with split view"
```

---

## Task 13: Pages — My Tasks & All Tasks

**Files:**
- Create: `app/(app)/tasks/page.tsx`
- Create: `app/(app)/tasks/all/page.tsx`

- [ ] **Step 1: Create My Tasks page**

`app/(app)/tasks/page.tsx`: Default view showing tasks assigned to current user. Uses `useTasks` with `assigneeId` filter. Header with task counts from `useTaskStats`.

- [ ] **Step 2: Create All Tasks page**

`app/(app)/tasks/all/page.tsx`: All tasks visible to user (department-scoped for staff, all for admin). Full filter bar.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/tasks/page.tsx app/(app)/tasks/all/page.tsx
git commit -m "feat(tasks): add My Tasks and All Tasks pages"
```

---

## Task 14: Sidebar Navigation Integration

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Add task navigation to sidebar**

In `app/(app)/layout.tsx`, add to `NAV` array:

```typescript
{ href: '/tasks', icon: CheckSquare, label: 'Công việc' },
```

Add `CheckSquare` import from `lucide-react`. Position after `Folder` (Dossiers).

- [ ] **Step 2: Verify navigation works**

Open browser, confirm sidebar shows "Công việc" nav item. Click navigates to `/tasks`.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/layout.tsx
git commit -m "feat(tasks): add tasks navigation to sidebar"
```

---

## Task 15: Integration Testing & Deployment Preparation

**Files:**
- Modify: `firestore.indexes.json` (verify)
- Test: Run all existing tests + new tests

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: ALL PASS (existing + new task tests)

- [ ] **Step 2: Build verification**

```bash
npm run build
```
Expected: 0 errors

- [ ] **Step 3: Deploy Firestore indexes**

```bash
firebase deploy --only firestore:indexes
```

- [ ] **Step 4: Deploy Cloud Functions**

```bash
cd functions && npm install && npm run build
firebase deploy --only functions
```

- [ ] **Step 5: End-to-end smoke test**

Manually test in browser:
1. Navigate to /tasks → see empty state
2. Create a task → verify in Firestore
3. Assign task → verify notification event created
4. Change status → verify state machine enforced
5. Add comment → verify in comment thread
6. Create subtask → verify progress calculation

- [ ] **Step 6: Commit & tag**

```bash
git add -A
git commit -m "feat(tasks): Phase 1 Task Core complete — integration verified"
git tag phase-1-task-core
```

---

## Summary

| Task | Component | Est. Steps |
|---|---|---|
| 1 | Domain Types & Constants | 4 |
| 2 | Validation & State Machine (TDD) | 5 |
| 3 | Progress Calculation (TDD) | 5 |
| 4 | RBAC Permissions (TDD) | 5 |
| 5 | Staff & Department Migration | 4 |
| 6 | Firestore Data Layer & Hooks | 6 |
| 7 | Cloud Functions (Server-Side) | 6 |
| 8 | UI: Badges & Filters | 4 |
| 9 | UI: Table & Cards | 3 |
| 10 | UI: Form & Subtasks | 3 |
| 11 | UI: Comments & Activities | 3 |
| 12 | UI: Task Detail Page | 3 |
| 13 | Pages: My Tasks & All Tasks | 3 |
| 14 | Sidebar Navigation | 3 |
| 15 | Integration & Deployment | 6 |
| **Total** | | **63 steps** |

**Subsequent phases** (separate plans):
- Phase 2: Kanban, Calendar, Dashboard, Bulk Operations
- Phase 3: Recurrence Engine (TaskSeries, scheduler, timezone)
- Phase 4: Checklist Migration
- Phase 5: Dependencies, Templates, Workflows
