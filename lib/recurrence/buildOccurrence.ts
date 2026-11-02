/**
 * Pure occurrence & subtask builder shared between client (lib/tasks/series.ts)
 * and server cron (app/api/cron/recurrence/route.ts).
 *
 * Returns plain JavaScript objects with Date values; callers convert Date fields
 * to client or admin Firestore Timestamps before persisting.
 */

import {
  occurrenceDocId,
  afterCompletionDocId,
  applyWeekendPolicy,
  normalizeMisfirePolicy,
  getStartOfTodayInTimezone,
  resolveWindowStart,
} from './generate'
import type { TaskPriority, RecurrenceType, WeekendPolicy, SubtaskTemplate } from '@/types/tasks'

export {
  occurrenceDocId,
  afterCompletionDocId,
  normalizeMisfirePolicy,
  getStartOfTodayInTimezone,
  resolveWindowStart,
}

export interface OccurrenceSeriesInput {
  id: string
  title: string
  description?: string | null
  recurrenceType?: RecurrenceType
  completionOffsetDays?: number
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  byWeekday?: number[] | null
  byMonthDay?: number[] | null
  byMonth?: number[] | null
  bySetPos?: number | null
  anchorDate?: unknown
  weekendPolicy?: WeekendPolicy
  occurrenceTime?: string | null
  leadDays?: number
  dueOffsetMinutes?: number
  status?: 'active' | 'paused' | 'ended'
  startDate?: unknown
  endDate?: unknown
  rollingWindowDays?: number
  lastGeneratedDate?: unknown
  misfirePolicy?: string | null
  timezone?: string
  createdBy?: string
  defaultAssigneeId?: string | null
  defaultCollaboratorIds?: string[]
  defaultFollowerIds?: string[]
  defaultPriority?: TaskPriority
  defaultEstimatedMinutes?: number | null
  defaultDossierIds?: string[]
  defaultDocumentIds?: string[]
  defaultDepartmentId?: string | null
  defaultCooperatingDepartmentIds?: string[]
  defaultTagIds?: string[]
  defaultSubtasks?: SubtaskTemplate[]
  templateId?: string | null
  previousSeriesId?: string | null
}

export interface BuildOccurrenceOptions {
  previousTaskId?: string | null
  taskId?: string
}

export interface PlainOccurrenceTaskData {
  taskCode: null
  title: string
  description: string | null
  type: 'single' | 'occurrence'
  status: 'pending'
  priority: TaskPriority
  progress: number
  progressMode: 'manual'
  isClosed: boolean

  startDate: Date | null
  dueDate: Date
  completedAt: Date | null
  estimatedMinutes: number | null
  occurrenceDate: Date
  visibleFrom: Date | null

  createdBy: string
  assigneeId: string | null
  assigneeName: string | null
  collaboratorIds: string[]
  followerIds: string[]

  departmentId: string | null
  cooperatingDepartmentIds: string[]
  assigneeDepartmentId: string | null

  blockedReason: null
  blockedByTaskIds: string[]
  blockedNote: null
  previousStatus: null

  dossierIds: string[]
  documentIds: string[]
  parentTaskId: string | null
  dependsOnTaskIds: string[]
  relatedTaskIds: string[]

  seriesId: string
  occurrenceKey: string
  templateId: string | null

  tagIds: string[]
  attachments: never[]
  source: 'recurring'

  previousTaskId: string | null
  isDetached: boolean

  deletedAt: null
  migratedFromChecklistId: null
}

export interface BuiltSubtask {
  id: string
  data: PlainOccurrenceTaskData
}

export interface BuiltOccurrence {
  taskId: string
  taskData: PlainOccurrenceTaskData
  subtasks: BuiltSubtask[]
}

/**
 * Convert a Date, Firestore Timestamp-like object, ISO string, or epoch ms to a plain Date.
 */
export function toPlainDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : new Date(value.getTime())
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate()
    return d instanceof Date && !isNaN(d.getTime()) ? new Date(d.getTime()) : null
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Pure builder for a single series occurrence and its subtask templates.
 * Subtask IDs are deterministic: `${taskId}_st${index}` (0-based template index).
 */
export function buildOccurrence(
  series: OccurrenceSeriesInput,
  occDate: Date,
  opts?: BuildOccurrenceOptions
): BuiltOccurrence {
  const previousTaskId = opts?.previousTaskId ?? null
  const taskId = opts?.taskId
    ? opts.taskId
    : series.recurrenceType === 'after_completion' && previousTaskId
      ? afterCompletionDocId(series.id, previousTaskId)
      : occurrenceDocId(series.id, occDate)

  const leadMs = (series.leadDays || 0) * 86400000
  const dueOffsetMs = (series.dueOffsetMinutes || 0) * 60000
  const occKey = `${series.id}:${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, '0')}-${String(occDate.getDate()).padStart(2, '0')}`
  const dueDate = new Date(occDate.getTime() + dueOffsetMs)
  const occurrenceDate = new Date(occDate.getTime())
  const visibleFrom = leadMs > 0 ? new Date(occDate.getTime() - leadMs) : null
  const priority: TaskPriority = series.defaultPriority || 'normal'
  const createdBy = series.createdBy || ''

  const taskData: PlainOccurrenceTaskData = {
    taskCode: null,
    title: series.title,
    description: series.description || '',
    type: 'occurrence',
    status: 'pending',
    priority,
    progress: 0,
    progressMode: 'manual',
    isClosed: false,

    startDate: null,
    dueDate,
    completedAt: null,
    estimatedMinutes: series.defaultEstimatedMinutes || null,
    occurrenceDate,
    visibleFrom,

    createdBy,
    assigneeId: series.defaultAssigneeId || null,
    assigneeName: null,
    collaboratorIds: series.defaultCollaboratorIds ? [...series.defaultCollaboratorIds] : [],
    followerIds: series.defaultFollowerIds ? [...series.defaultFollowerIds] : [],

    departmentId: series.defaultDepartmentId || null,
    cooperatingDepartmentIds: series.defaultCooperatingDepartmentIds
      ? [...series.defaultCooperatingDepartmentIds]
      : [],
    assigneeDepartmentId: series.defaultDepartmentId || null,

    blockedReason: null,
    blockedByTaskIds: [],
    blockedNote: null,
    previousStatus: null,

    dossierIds: series.defaultDossierIds ? [...series.defaultDossierIds] : [],
    documentIds: series.defaultDocumentIds ? [...series.defaultDocumentIds] : [],
    parentTaskId: null,
    dependsOnTaskIds: [],
    relatedTaskIds: [],

    seriesId: series.id,
    occurrenceKey: occKey,
    templateId: series.templateId || null,

    tagIds: series.defaultTagIds ? [...series.defaultTagIds] : [],
    attachments: [],
    source: 'recurring',

    previousTaskId,
    isDetached: false,

    deletedAt: null,
    migratedFromChecklistId: null,
  }

  const subtasks: BuiltSubtask[] = []
  if (series.defaultSubtasks && Array.isArray(series.defaultSubtasks) && series.defaultSubtasks.length > 0) {
    series.defaultSubtasks.forEach((st, index) => {
      const subId = `${taskId}_st${index}`
      const subData: PlainOccurrenceTaskData = {
        taskCode: null,
        title: st.title,
        description: st.description || null,
        type: 'single',
        status: 'pending',
        priority,
        progress: 0,
        progressMode: 'manual',
        isClosed: false,

        startDate: null,
        dueDate: new Date(dueDate.getTime()),
        completedAt: null,
        estimatedMinutes: st.estimatedMinutes || null,
        occurrenceDate: new Date(occurrenceDate.getTime()),
        visibleFrom: null,

        createdBy,
        assigneeId: series.defaultAssigneeId || null,
        assigneeName: null,
        collaboratorIds: [],
        followerIds: [],

        departmentId: series.defaultDepartmentId || null,
        cooperatingDepartmentIds: [],
        assigneeDepartmentId: series.defaultDepartmentId || null,

        blockedReason: null,
        blockedByTaskIds: [],
        blockedNote: null,
        previousStatus: null,

        dossierIds: series.defaultDossierIds ? [...series.defaultDossierIds] : [],
        documentIds: series.defaultDocumentIds ? [...series.defaultDocumentIds] : [],
        parentTaskId: taskId,
        dependsOnTaskIds: [],
        relatedTaskIds: [],

        seriesId: series.id,
        occurrenceKey: `${occKey}:subtask:${st.order ?? index}`,
        templateId: null,

        tagIds: series.defaultTagIds ? [...series.defaultTagIds] : [],
        attachments: [],
        source: 'recurring',

        previousTaskId: null,
        isDetached: false,

        deletedAt: null,
        migratedFromChecklistId: null,
      }
      subtasks.push({ id: subId, data: subData })
    })
  }

  return {
    taskId,
    taskData,
    subtasks,
  }
}

/**
 * Compute the next occurrence date for an 'after_completion' series given the completed task's completedAt.
 * Returns null if the computed date exceeds series.endDate.
 */
export function computeNextCompletionDate(
  series: Pick<OccurrenceSeriesInput, 'completionOffsetDays' | 'interval' | 'weekendPolicy' | 'endDate'>,
  completedAt?: unknown,
  now: Date = new Date()
): Date | null {
  const completedDate = toPlainDate(completedAt) ?? now
  const offsetDays = series.completionOffsetDays && series.completionOffsetDays > 0
    ? series.completionOffsetDays
    : (series.interval || 1)

  let nextDate = new Date(completedDate.getTime() + offsetDays * 86400000)

  if (series.weekendPolicy && series.weekendPolicy !== 'exact') {
    nextDate = applyWeekendPolicy(nextDate, series.weekendPolicy)
  }

  if (series.endDate) {
    const end = toPlainDate(series.endDate)
    if (end && nextDate > end) return null
  }

  return nextDate
}

export interface ExistingOccurrenceSummary {
  id: string
  type?: string | null
  status?: string | null
  occurrenceDate?: unknown
  completedAt?: unknown
  previousTaskId?: string | null
  parentTaskId?: string | null
  deletedAt?: unknown
}

/**
 * Determine whether an 'after_completion' series needs a new occurrence generated:
 * - Only considers main occurrences (`parentTaskId == null`, not deleted, `type === 'occurrence'` if present).
 * - If no main occurrence exists yet -> builds initial occurrence at startDate.
 * - If the latest main occurrence is 'completed' and has no successor (previousTaskId == latest.id)
 *   -> builds the next occurrence with deterministic ID `${series.id}_after_${latest.id}`.
 * - Otherwise returns null.
 */
export function planAfterCompletionOccurrence(
  series: OccurrenceSeriesInput,
  existingTasks: ExistingOccurrenceSummary[],
  now: Date = new Date()
): BuiltOccurrence | null {
  const mainTasks = existingTasks.filter(
    t => !t.parentTaskId && !t.deletedAt && (!t.type || t.type === 'occurrence')
  )

  if (mainTasks.length === 0) {
    const start = toPlainDate(series.startDate) ?? now
    let occDate = new Date(start.getTime())
    if (series.weekendPolicy && series.weekendPolicy !== 'exact') {
      occDate = applyWeekendPolicy(occDate, series.weekendPolicy)
    }
    if (series.endDate) {
      const end = toPlainDate(series.endDate)
      if (end && occDate > end) return null
    }
    return buildOccurrence(series, occDate, {
      previousTaskId: null,
      taskId: occurrenceDocId(series.id, occDate),
    })
  }

  const hasChildIds = new Set<string>()
  for (const t of mainTasks) {
    if (t.previousTaskId) {
      hasChildIds.add(t.previousTaskId)
    }
  }

  // Sort main occurrences chronologically; if dates tie, tasks without a successor come after tasks with a successor
  const sorted = [...mainTasks].sort((a, b) => {
    const aHasChild = hasChildIds.has(a.id) ? 0 : 1
    const bHasChild = hasChildIds.has(b.id) ? 0 : 1
    const aTime = toPlainDate(a.occurrenceDate)?.getTime() ?? 0
    const bTime = toPlainDate(b.occurrenceDate)?.getTime() ?? 0
    if (aTime !== bTime) return aTime - bTime
    return aHasChild - bHasChild
  })

  const latest = sorted[sorted.length - 1]
  if (!latest) return null
  if (latest.status !== 'completed') return null
  if (hasChildIds.has(latest.id)) return null

  const nextTaskId = afterCompletionDocId(series.id, latest.id)
  if (mainTasks.some(t => t.id === nextTaskId)) return null

  const nextDate = computeNextCompletionDate(series, latest.completedAt, now)
  if (!nextDate) return null

  return buildOccurrence(series, nextDate, {
    previousTaskId: latest.id,
    taskId: nextTaskId,
  })
}

export function isAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown; details?: unknown }
  if (e.code === 6 || e.code === '6' || e.code === 'ALREADY_EXISTS') return true
  if (typeof e.message === 'string' && e.message.includes('ALREADY_EXISTS')) return true
  if (typeof e.details === 'string' && e.details.includes('ALREADY_EXISTS')) return true
  return false
}

export interface AdminBatchFirestoreLike {
  collection(name: string): { doc(id: string): any }
  batch(): {
    create(ref: any, data: any): any
    commit(): Promise<unknown>
  }
}

/**
 * Atomically and idempotently create a built occurrence and its deterministic subtasks
 * using a single Admin SDK WriteBatch (`batch.create(main)` + `batch.create(subtask_i)`).
 * If commit() fails with ALREADY_EXISTS (gRPC code 6), treats as already existing and returns false.
 */
export async function createOccurrenceAdmin(
  firestore: AdminBatchFirestoreLike,
  built: BuiltOccurrence,
  mapData: (data: PlainOccurrenceTaskData) => Record<string, unknown> = d => ({ ...d })
): Promise<boolean> {
  const batch = firestore.batch()
  const taskRef = firestore.collection('tasks').doc(built.taskId)
  batch.create(taskRef, mapData(built.taskData))

  for (const st of built.subtasks) {
    const subRef = firestore.collection('tasks').doc(st.id)
    batch.create(subRef, mapData(st.data))
  }

  try {
    await batch.commit()
    return true
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      return false
    }
    throw err
  }
}
