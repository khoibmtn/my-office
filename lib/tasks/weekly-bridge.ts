/**
 * Bridge between Tasks module and Weekly Report ("Giao ban tuần") module.
 * - Pure helpers for grouping tasks into Friday -> Thursday briefing periods
 * - Idempotent client Firestore transaction to append a completed task to weeklyReports/{weekId}.workItems
 */

import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import { isVisibleTask, toMillis } from '@/lib/tasks/firestore'
import { ACTIVE_STATUSES, TASK_PRIORITY_ORDER } from '@/lib/tasks/constants'
import {
  addDays,
  currentWeekId,
  formatDM,
  formatDMY,
  resolvePeriod,
  todayVN,
  weekIdForDate,
} from '@/lib/weekly-report/period'
import { newId } from '@/lib/weekly-report/outline'
import type { Task, TaskStatus } from '@/types/tasks'
import type { ISODate, WeekPeriod, WeekPeriodInfo, WorkItem } from '@/types/weekly-report'

const WEEKLY_REPORTS = 'weeklyReports'
const TASKS = 'tasks'

export interface WeeklyTaskGroups {
  overdue: Task[]
  dueInPeriod: Task[]
  completedInPeriod: Task[]
  unscheduledOpen: Task[]
}

export type AppendTaskToWeeklyResult =
  | { ok: true; status: 'added' | 'already_added'; weekId: string; message: string }
  | { ok: false; status: 'missing_week'; weekId: string; message: string }

/** Convert Timestamp / Date / ms / string to Vietnam calendar date 'YYYY-MM-DD'. */
export function timestampToVNDate(val: unknown): ISODate | null {
  const ms = toMillis(val)
  if (ms === null) return null
  return todayVN(new Date(ms))
}

/** End of calendar day (23:59:59+07:00) for an ISODate in Vietnam timezone. */
export function periodEndTimestamp(periodEnd: ISODate): Timestamp {
  return Timestamp.fromDate(new Date(`${periodEnd}T23:59:59+07:00`))
}

/** Resolve current default weekId + period from saved weeks (Friday -> Thursday). */
export function getDefaultWeeklyPeriod(
  weeks: WeekPeriodInfo[] = [],
  now: Date = new Date()
): { weekId: string; period: WeekPeriod } {
  const weekId = currentWeekId(todayVN(now), weeks)
  const period = resolvePeriod(weekId, weeks)
  return { weekId, period }
}

/** Shift weekId by N weeks (-1 previous, +1 next) and resolve its period. */
export function shiftWeeklyPeriod(
  weekId: string,
  deltaWeeks: number,
  weeks: WeekPeriodInfo[] = []
): WeekPeriod {
  const targetWeekId = addDays(weekId, deltaWeeks * 7)
  return resolvePeriod(targetWeekId, weeks)
}

/** Short period header label: "Giao ban dd/MM · kỳ dd/MM–dd/MM". */
export function formatPeriodBanner(period: WeekPeriod, actualMeetingDate?: ISODate | null): string {
  const dm = (d: ISODate) => formatDMY(d).slice(0, 5) || formatDM(d)
  const meeting = actualMeetingDate || period.meetingDate
  return `Giao ban ${dm(meeting)} · kỳ ${dm(period.periodStart)}–${dm(period.periodEnd)}`
}

/** Full period label with years for tooltips / secondary descriptions. */
export function formatPeriodFullTooltip(
  period: WeekPeriod,
  actualMeetingDate?: ISODate | null
): string {
  const meeting = actualMeetingDate || period.meetingDate
  return `Giao ban ${formatDMY(meeting)} · kỳ ${formatDMY(period.periodStart)}–${formatDMY(period.periodEnd)}`
}

function isTaskOpen(task: Partial<Task>): boolean {
  if (Boolean(task.isClosed)) return false
  if (task.status === 'completed' || task.status === 'cancelled') return false
  if (task.status !== undefined) {
    return ACTIVE_STATUSES.includes(task.status as TaskStatus)
  }
  return true
}

function isTaskCompleted(task: Partial<Task>): boolean {
  return (
    task.status === 'completed' ||
    (Boolean(task.isClosed) && task.completedAt != null && task.status !== 'cancelled')
  )
}

function sortByDueAndPriority(a: Task, b: Task): number {
  const dueA = toMillis(a.dueDate) ?? Infinity
  const dueB = toMillis(b.dueDate) ?? Infinity
  if (dueA !== dueB) return dueA - dueB
  return (TASK_PRIORITY_ORDER[a.priority] ?? 99) - (TASK_PRIORITY_ORDER[b.priority] ?? 99)
}

/**
 * Pure helper to group visible top-level tasks into weekly briefing buckets:
 * - overdue: open tasks whose dueDate < now
 * - dueInPeriod: non-overdue open tasks whose dueDate falls in [periodStart, periodEnd] (VN calendar)
 * - completedInPeriod: completed tasks whose completedAt (fallback updatedAt) falls in [periodStart, periodEnd]
 * - unscheduledOpen: open tasks without a dueDate
 */
export function groupTasksForWeeklyPeriod(
  tasks: ReadonlyArray<Task>,
  period: WeekPeriod,
  now: number | Date = Date.now()
): WeeklyTaskGroups {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const overdue: Task[] = []
  const dueInPeriod: Task[] = []
  const completedInPeriod: Task[] = []
  const unscheduledOpen: Task[] = []

  for (const task of tasks) {
    if (!isVisibleTask(task, nowMs)) continue

    if (isTaskOpen(task)) {
      const dueMs = toMillis(task.dueDate)
      if (dueMs === null) {
        unscheduledOpen.push(task)
        continue
      }
      if (dueMs < nowMs) {
        overdue.push(task)
        continue
      }
      const dueVN = timestampToVNDate(task.dueDate)
      if (dueVN && dueVN >= period.periodStart && dueVN <= period.periodEnd) {
        dueInPeriod.push(task)
      }
      continue
    }

    if (isTaskCompleted(task)) {
      const completedVN = timestampToVNDate(task.completedAt ?? task.updatedAt)
      if (completedVN && completedVN >= period.periodStart && completedVN <= period.periodEnd) {
        completedInPeriod.push(task)
      }
    }
  }

  overdue.sort(sortByDueAndPriority)
  dueInPeriod.sort(sortByDueAndPriority)
  completedInPeriod.sort((a, b) => {
    const compA = toMillis(a.completedAt ?? a.updatedAt) ?? 0
    const compB = toMillis(b.completedAt ?? b.updatedAt) ?? 0
    return compB - compA
  })
  unscheduledOpen.sort((a, b) => {
    const prioDiff = (TASK_PRIORITY_ORDER[a.priority] ?? 99) - (TASK_PRIORITY_ORDER[b.priority] ?? 99)
    if (prioDiff !== 0) return prioDiff
    return (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0)
  })

  return { overdue, dueInPeriod, completedInPeriod, unscheduledOpen }
}

/**
 * Pure idempotent helper: append a task as a WorkItem (`source: 'task'`) if `taskId` is not already present.
 */
export function appendTaskWorkItemPure(
  existingItems: ReadonlyArray<WorkItem>,
  task: Pick<Task, 'id' | 'title'>,
  makeId: () => string = newId
): { items: WorkItem[]; added: boolean; item: WorkItem } {
  const normalizedExisting = existingItems.map((it, idx) => ({ ...it, order: idx }))
  const found = normalizedExisting.find((it) => it.taskId === task.id)
  if (found) {
    return { items: normalizedExisting, added: false, item: found }
  }

  const item: WorkItem = {
    id: makeId(),
    text: task.title.trim() || task.title,
    highlight: false,
    pinned: false,
    order: normalizedExisting.length,
    source: 'task',
    taskId: task.id,
    children: [],
  }

  return {
    items: [...normalizedExisting, item],
    added: true,
    item,
  }
}

/**
 * Append a completed task to `weeklyReports/{weekId}.workItems` without duplicating `taskId`,
 * and mark `tasks/{task.id}.weeklyReportWeekId = weekId`.
 * If the weekly report document does not exist yet, skips without creating it and returns
 * `{ ok: false, status: 'missing_week', message: 'Mở trang Giao ban tuần trước' }`.
 */
export async function appendTaskToWeeklyReport(
  task: Pick<Task, 'id' | 'title'> &
    Partial<Pick<Task, 'completedAt' | 'dueDate' | 'weeklyReportWeekId'>>,
  opts?: { weekId?: string; weeks?: WeekPeriodInfo[] }
): Promise<AppendTaskToWeeklyResult> {
  const completedDate = timestampToVNDate(task.completedAt) ?? timestampToVNDate(task.dueDate)
  const targetWeekId =
    opts?.weekId ||
    (completedDate
      ? weekIdForDate(completedDate, opts?.weeks)
      : currentWeekId(todayVN(), opts?.weeks))

  await ensureAuth()

  return runTransaction(db(), async (tx) => {
    const weekRef = doc(db(), WEEKLY_REPORTS, targetWeekId)
    const taskRef = doc(db(), TASKS, task.id)

    const [weekSnap, taskSnap] = await Promise.all([tx.get(weekRef), tx.get(taskRef)])

    if (!weekSnap.exists()) {
      return {
        ok: false,
        status: 'missing_week',
        weekId: targetWeekId,
        message: 'Mở trang Giao ban tuần trước',
      }
    }

    const weekData = weekSnap.data() as { workItems?: WorkItem[] } | undefined
    const existingWorkItems = Array.isArray(weekData?.workItems) ? weekData.workItems : []
    const { items, added } = appendTaskWorkItemPure(existingWorkItems, task)

    if (added) {
      tx.update(weekRef, {
        workItems: items,
        updatedAt: serverTimestamp(),
      })
    }

    if (taskSnap.exists()) {
      const currentWeekIdOnTask = (taskSnap.data() as { weeklyReportWeekId?: string | null })
        ?.weeklyReportWeekId
      if (added || currentWeekIdOnTask !== targetWeekId) {
        tx.update(taskRef, {
          weeklyReportWeekId: targetWeekId,
          updatedAt: serverTimestamp(),
        })
      }
    }

    return {
      ok: true,
      status: added ? 'added' : 'already_added',
      weekId: targetWeekId,
      message: added ? 'Đã đưa vào Giao ban tuần' : 'Việc này đã có trong Giao ban tuần',
    }
  })
}
