/**
 * Task Firestore read queries & pure task visibility/stats/filter helpers.
 * All mutations go through mutations.ts.
 * These are READ-ONLY query builders, direct reads, and pure calculation helpers.
 */

import {
  collection, doc, getDoc, query,
  where, orderBy, onSnapshot, Timestamp,
  type Query, type DocumentData,
} from 'firebase/firestore'
import { db } from '../firebase'
import { ACTIVE_STATUSES } from './constants'
import type { Task, TaskStatus, TaskPriority } from '@/types/tasks'

const TASKS = 'tasks'
const TASK_COMMENTS = 'taskComments'
const TASK_ACTIVITIES = 'taskActivities'

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const VN_OFFSET_MS = 7 * 60 * 60 * 1000 // Asia/Ho_Chi_Minh (UTC+7, no DST)

// ===== Pure Time, Visibility, Stats & Filtering Helpers =====

/**
 * Safely convert a Firestore Timestamp, Date, number (ms), or ISO string to epoch milliseconds.
 */
export function toMillis(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null
  if (val instanceof Date) {
    const t = val.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, any>
    if (typeof obj.toMillis === 'function') {
      const ms = obj.toMillis()
      return typeof ms === 'number' && Number.isFinite(ms) ? ms : null
    }
    if (typeof obj.toDate === 'function') {
      const d = obj.toDate()
      if (d instanceof Date && Number.isFinite(d.getTime())) return d.getTime()
    }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000 + Math.floor((obj.nanoseconds || 0) / 1_000_000)
    }
  }
  if (typeof val === 'string') {
    const t = Date.parse(val)
    return Number.isFinite(t) ? t : null
  }
  return null
}

/**
 * Pure helper to check whether a task should be visible in lists/calendar/kanban/dashboard:
 * - Not soft-deleted (`deletedAt == null`)
 * - `visibleFrom` is null or `<= now`
 * - Top-level task (`parentTaskId == null`) unless `options.includeSubtasks` is true
 */
export function isVisibleTask(
  task: Partial<Task> | null | undefined,
  now: number | Date = Date.now(),
  options?: { includeSubtasks?: boolean }
): boolean {
  if (!task) return false
  if (task.deletedAt != null) return false
  if (!options?.includeSubtasks && task.parentTaskId != null && task.parentTaskId !== '') {
    return false
  }
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const visibleFromMs = toMillis(task.visibleFrom)
  if (visibleFromMs !== null && visibleFromMs > nowMs) {
    return false
  }
  return true
}

/**
 * Compute start/end boundaries for current week (starting Monday) and current month
 * in Vietnam timezone (`Asia/Ho_Chi_Minh`, UTC+7).
 */
export function getVietnamTimeBounds(now: number | Date = Date.now()) {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const vnNow = new Date(nowMs + VN_OFFSET_MS)

  const year = vnNow.getUTCFullYear()
  const month = vnNow.getUTCMonth()
  const day = vnNow.getUTCDate()
  const dayOfWeek = vnNow.getUTCDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Week starts on Monday (ISO weekday 1)
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const weekStartMs = Date.UTC(year, month, day - daysSinceMonday, 0, 0, 0, 0) - VN_OFFSET_MS
  const weekEndMs = weekStartMs + SEVEN_DAYS_MS

  // Month starts on 1st 00:00:00 Asia/Ho_Chi_Minh
  const monthStartMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - VN_OFFSET_MS
  const monthEndMs = Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - VN_OFFSET_MS

  return {
    nowMs,
    weekStartMs,
    weekEndMs,
    monthStartMs,
    monthEndMs,
  }
}

/**
 * Compute the `since` timestamp (ms) for the closed tasks listener:
 * `min(now - 30 days, start of current month in Asia/Ho_Chi_Minh)`
 * Ensures monthly statistics on the 31st of a month never miss tasks completed on the 1st.
 */
export function getClosedTasksSinceMs(now: number | Date = Date.now()): number {
  const { nowMs, monthStartMs } = getVietnamTimeBounds(now)
  return Math.min(nowMs - THIRTY_DAYS_MS, monthStartMs)
}

/**
 * Pure helper to merge snapshots from the open-tasks listener (`isClosed == false`)
 * and the recent-closed-tasks listener (`isClosed == true && updatedAt >= since`).
 *
 * Prevents a just-closed task from disappearing temporarily while its `updatedAt: serverTimestamp()`
 * is still pending or before the closed-tasks listener delivers it:
 * - If both listeners contain the same task, the newer snapshot wins (a closed snapshot with
 *   pending/null `updatedAt` or `isClosed == true` takes precedence over a stale open snapshot).
 * - If a non-deleted task from `previousTasks` disappeared from `openTasks` and has not yet
 *   appeared in `closedTasks` (and is not in `deletedIds`), it is retained with `isClosed: true`
 *   (and `status: 'completed'` if it was still in an active status) until `closedTasks` emits it.
 */
export function mergeTaskSnapshots(
  openTasks: ReadonlyArray<Task>,
  closedTasks: ReadonlyArray<Task>,
  previousTasks: ReadonlyArray<Task> = [],
  deletedIds?: ReadonlySet<string>,
  retention?: {
    /** false when the closed-tasks listener errored (e.g. missing index) — never retain then */
    allowRetain?: boolean
    now?: number
    /** id → first time (ms) the task was retained; mutated in place by this function */
    retainedSince?: Map<string, number>
    maxRetainMs?: number
  }
): Task[] {
  const map = new Map<string, Task>()
  const openIds = new Set<string>()
  const closedIds = new Set<string>()

  for (const t of openTasks) {
    if (t.deletedAt == null && !deletedIds?.has(t.id)) {
      map.set(t.id, t)
      openIds.add(t.id)
    }
  }

  for (const t of closedTasks) {
    if (t.deletedAt == null && !deletedIds?.has(t.id)) {
      closedIds.add(t.id)
      const existing = map.get(t.id)
      if (!existing) {
        map.set(t.id, t)
      } else {
        // Pending serverTimestamp() (null) or newer/equal updatedAt wins over open snapshot
        const closedUpdatedMs = toMillis(t.updatedAt) ?? Number.MAX_SAFE_INTEGER
        const openUpdatedMs = toMillis(existing.updatedAt) ?? 0
        if (closedUpdatedMs >= openUpdatedMs) {
          map.set(t.id, t)
        }
      }
    }
  }

  // Retain tasks from previousTasks that just left openTasks (e.g. just closed with pending serverTimestamp)
  // and have not yet been delivered by closedTasks, unless soft-deleted.
  const allowRetain = retention?.allowRetain ?? true
  const now = retention?.now ?? Date.now()
  const maxRetainMs = retention?.maxRetainMs ?? 30_000
  const retainedSince = retention?.retainedSince
  if (retainedSince) {
    // Forget retention timers for tasks that are delivered by a listener again
    Array.from(retainedSince.keys()).forEach((id) => {
      if (openIds.has(id) || closedIds.has(id)) retainedSince.delete(id)
    })
  }

  for (const prev of previousTasks) {
    if (!allowRetain) break
    if (!prev || prev.deletedAt != null || deletedIds?.has(prev.id)) continue
    if (map.has(prev.id)) continue

    if (!openIds.has(prev.id) && !closedIds.has(prev.id)) {
      if (retainedSince) {
        const since = retainedSince.get(prev.id) ?? now
        if (now - since > maxRetainMs) {
          // Closed listener never delivered it (out of window, listener issue…) — stop showing a ghost
          retainedSince.delete(prev.id)
          continue
        }
        retainedSince.set(prev.id, since)
      }
      const transitionedToClosed: Task = prev.isClosed
        ? prev
        : {
            ...prev,
            isClosed: true,
            status: prev.status === 'cancelled' ? 'cancelled' : 'completed',
          }
      map.set(prev.id, transitionedToClosed)
    }
  }

  const merged = Array.from(map.values())
  merged.sort((a, b) => {
    const timeA = toMillis(a.createdAt) ?? 0
    const timeB = toMillis(b.createdAt) ?? 0
    return timeB - timeA
  })
  return merged
}

export interface ComputedTaskStats {
  total: number
  open: number
  active: number
  pending: number
  inProgress: number
  blocked: number
  completed: number
  cancelled: number
  overdue: number
  dueIn7Days: number
  due7: number
  completedThisWeek: number
  completedThisMonth: number
  completionRate: number
}

function isTaskOpen(t: Partial<Task>): boolean {
  if (Boolean(t.isClosed)) return false
  if (t.status === 'completed' || t.status === 'cancelled') return false
  if (t.status !== undefined) {
    return ACTIVE_STATUSES.includes(t.status as TaskStatus)
  }
  return true
}

function isTaskCompleted(t: Partial<Task>): boolean {
  return (
    t.status === 'completed' ||
    (t.status === undefined && Boolean(t.isClosed) && t.completedAt != null)
  )
}

/**
 * Pure helper to compute task statistics:
 * - open (`!isClosed` / in `ACTIVE_STATUSES`)
 * - overdue (`dueDate < now && !isClosed`)
 * - dueIn7Days / due7 (`now <= dueDate <= now + 7 days && !isClosed`)
 * - completedThisWeek / completedThisMonth (by `completedAt`, Monday-start week, Asia/Ho_Chi_Minh)
 * - completionRate = completed / (total - cancelled) (percentage 0-100)
 */
export function computeTaskStats(
  tasks: ReadonlyArray<Partial<Task>>,
  now: number | Date = Date.now()
): ComputedTaskStats {
  const { nowMs, weekStartMs, weekEndMs, monthStartMs, monthEndMs } = getVietnamTimeBounds(now)
  const sevenDaysLaterMs = nowMs + SEVEN_DAYS_MS

  const visible = tasks.filter((t) => isVisibleTask(t, nowMs))

  let pending = 0
  let inProgress = 0
  let blocked = 0
  let completed = 0
  let cancelled = 0
  let open = 0
  let overdue = 0
  let dueIn7Days = 0
  let completedThisWeek = 0
  let completedThisMonth = 0

  for (const t of visible) {
    const status = t.status
    if (status === 'pending') pending++
    else if (status === 'in_progress') inProgress++
    else if (status === 'blocked') blocked++
    else if (status === 'completed') completed++
    else if (status === 'cancelled') cancelled++

    if (isTaskOpen(t)) {
      open++
      const dueMs = toMillis(t.dueDate)
      if (dueMs !== null) {
        if (dueMs < nowMs) {
          overdue++
        } else if (dueMs <= sevenDaysLaterMs) {
          dueIn7Days++
        }
      }
    }

    if (isTaskCompleted(t)) {
      const completedAtMs = toMillis(t.completedAt)
      if (completedAtMs !== null) {
        if (completedAtMs >= weekStartMs && completedAtMs < weekEndMs) {
          completedThisWeek++
        }
        if (completedAtMs >= monthStartMs && completedAtMs < monthEndMs) {
          completedThisMonth++
        }
      }
    }
  }

  const total = visible.length
  const denominator = total - cancelled
  const completionRate = denominator > 0 ? Math.round((completed / denominator) * 100) : 0

  return {
    total,
    open,
    active: open,
    pending,
    inProgress,
    blocked,
    completed,
    cancelled,
    overdue,
    dueIn7Days,
    due7: dueIn7Days,
    completedThisWeek,
    completedThisMonth,
    completionRate,
  }
}

export type SpecialTaskStatus = 'overdue' | 'due7' | 'open' | 'done_week' | 'done_month'

export interface TaskQueryFilterParams {
  status?: TaskStatus | SpecialTaskStatus | 'all' | string | null
  priority?: TaskPriority | 'all' | string | null
  assigneeId?: string | 'all' | null
  includeCollaborator?: boolean | string | null
  departmentId?: string | 'all' | null
  searchQuery?: string | null
}

/**
 * Pure helper to filter tasks using the exact same definitions as `computeTaskStats`
 * and `/tasks` URL searchParams (`status=overdue|due7|open|done_week|done_month|...`,
 * `assigneeId`, `includeCollaborator=1`, multi-value `departmentId=a,b`, `priority`, `searchQuery`).
 */
export function filterTasksByParams<T extends Partial<Task>>(
  tasks: ReadonlyArray<T>,
  params: TaskQueryFilterParams,
  now: number | Date = Date.now()
): T[] {
  const { nowMs, weekStartMs, weekEndMs, monthStartMs, monthEndMs } = getVietnamTimeBounds(now)
  const sevenDaysLaterMs = nowMs + SEVEN_DAYS_MS

  const search = params.searchQuery?.toLowerCase().trim() || ''
  const status = params.status || 'all'
  const priority = params.priority || 'all'
  const assigneeId = params.assigneeId || 'all'
  const includeCollab =
    params.includeCollaborator === true ||
    params.includeCollaborator === '1' ||
    params.includeCollaborator === 'true'
  const deptParam = params.departmentId || 'all'
  const deptIds =
    deptParam !== 'all'
      ? deptParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  return tasks.filter((t) => {
    if (!isVisibleTask(t, nowMs)) return false

    if (search && !(t.title || '').toLowerCase().includes(search)) {
      return false
    }

    if (status === 'overdue') {
      const dueMs = toMillis(t.dueDate)
      if (!isTaskOpen(t) || dueMs === null || dueMs >= nowMs) return false
    } else if (status === 'due7') {
      const dueMs = toMillis(t.dueDate)
      if (!isTaskOpen(t) || dueMs === null || dueMs < nowMs || dueMs > sevenDaysLaterMs) {
        return false
      }
    } else if (status === 'open') {
      if (!isTaskOpen(t)) return false
    } else if (status === 'done_week') {
      const completedAtMs = toMillis(t.completedAt)
      if (
        !isTaskCompleted(t) ||
        completedAtMs === null ||
        completedAtMs < weekStartMs ||
        completedAtMs >= weekEndMs
      ) {
        return false
      }
    } else if (status === 'done_month') {
      const completedAtMs = toMillis(t.completedAt)
      if (
        !isTaskCompleted(t) ||
        completedAtMs === null ||
        completedAtMs < monthStartMs ||
        completedAtMs >= monthEndMs
      ) {
        return false
      }
    } else if (status !== 'all') {
      if (t.status !== status) return false
    }

    if (priority !== 'all' && t.priority !== priority) {
      return false
    }

    if (assigneeId !== 'all') {
      if (includeCollab) {
        const isAssignee = t.assigneeId === assigneeId
        const isCollab = Boolean(t.collaboratorIds?.includes(assigneeId))
        if (!isAssignee && !isCollab) return false
      } else if (t.assigneeId !== assigneeId) {
        return false
      }
    }

    if (deptIds.length > 0) {
      const taskDeptId = t.departmentId || t.assigneeDepartmentId
      if (!taskDeptId || !deptIds.includes(taskDeptId)) return false
    }

    return true
  })
}

// ===== Single Document Reads =====

export async function getTask(taskId: string): Promise<Task | null> {
  const snap = await getDoc(doc(db(), TASKS, taskId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Task
}

// ===== Query Builders =====

/** My Tasks: assigned to me */
export function queryMyTasks(assigneeId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('assigneeId', '==', assigneeId)
  )
}

/** Tasks by department */
export function queryDepartmentTasks(departmentId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('departmentId', '==', departmentId)
  )
}

/** All open (non-closed) tasks */
export function queryAllActiveTasks(): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('isClosed', '==', false)
  )
}

/**
 * Closed tasks (completed or cancelled) updated within the given window
 * (default: `min(now - 30 days, start of current month in Asia/Ho_Chi_Minh)`).
 * Uses `updatedAt >= since` so cancelled tasks (where `completedAt` is null) are also included.
 */
export function queryRecentClosedTasks(
  sinceMs: number = getClosedTasksSinceMs()
): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('isClosed', '==', true),
    where('updatedAt', '>=', Timestamp.fromMillis(sinceMs)),
    orderBy('updatedAt', 'desc')
  )
}

/** Tasks linked to a specific dossier */
export function queryDossierTasks(dossierId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('dossierIds', 'array-contains', dossierId)
  )
}

/** Tasks linked to a specific document */
export function queryDocumentTasks(documentId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('documentIds', 'array-contains', documentId)
  )
}

/** Tasks belonging to a recurring series (or all occurrence tasks when seriesId omitted) */
export function querySeriesTasks(seriesId?: string): Query<DocumentData> {
  if (seriesId) {
    return query(
      collection(db(), TASKS),
      where('seriesId', '==', seriesId)
    )
  }
  return query(
    collection(db(), TASKS),
    where('type', '==', 'occurrence')
  )
}

/** Subtasks of a parent task */
export function querySubtasks(parentTaskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('parentTaskId', '==', parentTaskId)
  )
}

/** Overdue tasks (open tasks only) */
export function queryOverdueTasks(assigneeId?: string): Query<DocumentData> {
  if (assigneeId) {
    return query(
      collection(db(), TASKS),
      where('assigneeId', '==', assigneeId),
      where('isClosed', '==', false)
    )
  }
  return query(
    collection(db(), TASKS),
    where('isClosed', '==', false)
  )
}

/** Tasks created by a specific user */
export function queryCreatedByTasks(createdBy: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('createdBy', '==', createdBy)
  )
}

/** Completed tasks */
export function queryCompletedTasks(
  since: Date = new Date(Date.now() - THIRTY_DAYS_MS),
  assigneeId?: string
): Query<DocumentData> {
  if (assigneeId) {
    return query(
      collection(db(), TASKS),
      where('assigneeId', '==', assigneeId),
      where('status', '==', 'completed'),
      where('completedAt', '>=', Timestamp.fromDate(since))
    )
  }
  return query(
    collection(db(), TASKS),
    where('isClosed', '==', true),
    where('completedAt', '>=', Timestamp.fromDate(since))
  )
}

// ===== Comments & Activities =====

export function queryTaskComments(taskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASK_COMMENTS),
    where('taskId', '==', taskId)
  )
}

export function queryTaskActivities(taskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASK_ACTIVITIES),
    where('taskId', '==', taskId)
  )
}

// ===== Real-time Subscriptions =====

export function subscribeToQuery(
  q: Query<DocumentData>,
  onData: (items: any[], meta?: { deletedIds: string[] }) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    q,
    (snap) => {
      const rawItems = snap.docs.map((d) => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' }),
      }))
      const deletedIds: string[] = []
      const items: any[] = []
      for (const item of rawItems as any[]) {
        if (item.deletedAt != null) {
          deletedIds.push(item.id)
        } else {
          items.push(item)
        }
      }
      onData(items, { deletedIds })
    },
    (err) => {
      console.error('[tasks/firestore] snapshot error:', err)
      onError?.(err)
    }
  )
}
