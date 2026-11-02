/**
 * TaskSeries Firestore queries and mutations.
 * Manages recurring task series lifecycle.
 */

import {
  collection, doc, query, where, orderBy,
  addDoc, updateDoc, getDoc, getDocs,
  serverTimestamp, writeBatch, Timestamp, runTransaction,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateOccurrences } from '@/lib/recurrence/generate'
import {
  buildOccurrence,
  afterCompletionDocId,
  computeNextCompletionDate,
  planAfterCompletionOccurrence,
  resolveWindowStart,
  normalizeMisfirePolicy,
  toPlainDate,
  type BuiltOccurrence,
  type PlainOccurrenceTaskData,
} from '@/lib/recurrence/buildOccurrence'
import type { RecurrenceRule } from '@/lib/recurrence/types'
import type { TaskSeries, Task } from '@/types/tasks'

const SERIES_COLLECTION = 'taskSeries'
const TASKS_COLLECTION = 'tasks'

// ===== Queries =====

export function queryActiveSeries() {
  return query(
    collection(db(), SERIES_COLLECTION),
    orderBy('createdAt', 'desc')
  )
}

export function querySeriesByDepartment(departmentId: string) {
  return query(
    collection(db(), SERIES_COLLECTION),
    where('defaultDepartmentId', '==', departmentId)
  )
}

export function queryTasksBySeries(seriesId: string) {
  return query(
    collection(db(), TASKS_COLLECTION),
    where('seriesId', '==', seriesId)
  )
}

// ===== Mutations =====

export async function createTaskSeries(
  data: Omit<TaskSeries, 'id' | 'createdAt' | 'updatedAt' | 'lastGeneratedDate'>,
  actorId: string
): Promise<string> {
  const docRef = await addDoc(collection(db(), SERIES_COLLECTION), {
    ...data,
    createdBy: actorId,
    lastGeneratedDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateTaskSeries(
  seriesId: string,
  updates: Partial<TaskSeries>,
  actorId: string
): Promise<void> {
  const ref = doc(db(), SERIES_COLLECTION, seriesId)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function pauseTaskSeries(seriesId: string): Promise<void> {
  await updateDoc(doc(db(), SERIES_COLLECTION, seriesId), {
    status: 'paused',
    updatedAt: serverTimestamp(),
  })
}

export async function resumeTaskSeries(seriesId: string): Promise<void> {
  await updateDoc(doc(db(), SERIES_COLLECTION, seriesId), {
    status: 'active',
    updatedAt: serverTimestamp(),
  })
}

export async function endTaskSeries(seriesId: string): Promise<void> {
  await updateDoc(doc(db(), SERIES_COLLECTION, seriesId), {
    status: 'ended',
    endDate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// ===== Occurrence Generation =====

function toFirestoreTaskData(data: PlainOccurrenceTaskData): Omit<Task, 'id'> {
  return {
    ...data,
    startDate: data.startDate ? Timestamp.fromDate(data.startDate) : null,
    dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
    completedAt: data.completedAt ? Timestamp.fromDate(data.completedAt) : null,
    occurrenceDate: data.occurrenceDate ? Timestamp.fromDate(data.occurrenceDate) : null,
    visibleFrom: data.visibleFrom ? Timestamp.fromDate(data.visibleFrom) : null,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
    deletedAt: null,
  }
}

/**
 * Idempotently persist a built occurrence and its deterministic subtasks in a single Firestore transaction.
 * Returns true if the occurrence was created, false if it already existed.
 */
export async function persistOccurrenceTransaction(built: BuiltOccurrence): Promise<boolean> {
  const firestore = db()
  const taskRef = doc(firestore, TASKS_COLLECTION, built.taskId)

  return runTransaction(firestore, async (tx) => {
    const existing = await tx.get(taskRef)
    if (existing.exists()) {
      return false
    }

    tx.set(taskRef, toFirestoreTaskData(built.taskData))

    for (const st of built.subtasks) {
      const subRef = doc(firestore, TASKS_COLLECTION, st.id)
      tx.set(subRef, toFirestoreTaskData(st.data))
    }

    return true
  })
}

/**
 * Generate occurrences for a single series within a rolling window.
 * Uses deterministic document IDs and Firestore transactions for idempotency.
 *
 * Returns count of newly created occurrences.
 */
export async function generateSeriesOccurrences(
  series: TaskSeries,
  windowEnd: Date
): Promise<number> {
  if (series.status !== 'active') return 0

  const now = new Date()

  // Handle after_completion series
  if (series.recurrenceType === 'after_completion') {
    const existingSnap = await getDocs(query(
      collection(db(), TASKS_COLLECTION),
      where('seriesId', '==', series.id)
    ))

    const summaries = existingSnap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        type: data.type,
        status: data.status,
        occurrenceDate: data.occurrenceDate,
        completedAt: data.completedAt,
        previousTaskId: data.previousTaskId,
        parentTaskId: data.parentTaskId,
        deletedAt: data.deletedAt,
      }
    })

    const planned = planAfterCompletionOccurrence(series, summaries, now)
    if (!planned) return 0

    const created = await persistOccurrenceTransaction(planned)
    if (!created) return 0

    await updateDoc(doc(db(), SERIES_COLLECTION, series.id), {
      lastGeneratedDate: Timestamp.fromDate(planned.taskData.occurrenceDate),
      updatedAt: serverTimestamp(),
    })
    return 1
  }

  const rule: RecurrenceRule = {
    frequency: series.frequency,
    interval: series.interval,
    byWeekday: series.byWeekday ? series.byWeekday : undefined,
    byMonthDay: series.byMonthDay ? series.byMonthDay : undefined,
    byMonth: series.byMonth ? series.byMonth : undefined,
    bySetPos: series.bySetPos !== null && series.bySetPos !== undefined ? series.bySetPos : undefined,
    weekendPolicy: series.weekendPolicy || 'exact',
    anchorDate: toPlainDate(series.anchorDate) ?? now,
    timezone: series.timezone || 'Asia/Ho_Chi_Minh',
  }

  // Determine window start applying misfirePolicy (CREATE_MISSED vs SKIP_MISSED)
  const windowStart = resolveWindowStart({
    lastGeneratedDate: toPlainDate(series.lastGeneratedDate),
    startDate: toPlainDate(series.startDate),
    misfirePolicy: series.misfirePolicy,
    now,
    timezone: series.timezone || 'Asia/Ho_Chi_Minh',
  })

  // Check endDate
  if (series.endDate) {
    const end = toPlainDate(series.endDate)
    if (end) {
      if (windowStart > end) return 0
      if (windowEnd > end) windowEnd = end
    }
  }

  // Generate dates
  const occurrenceDates = generateOccurrences(rule, windowStart, windowEnd, {
    misfirePolicy: series.misfirePolicy,
    now,
  })
  if (occurrenceDates.length === 0) return 0

  // Query existing occurrences to maintain previousTaskId chain
  const existingSnap = await getDocs(query(
    collection(db(), TASKS_COLLECTION),
    where('seriesId', '==', series.id)
  ))
  const existingTasks: { id: string; occurrenceDate: Date }[] = existingSnap.docs
    .map(d => {
      const data = d.data()
      if (data.parentTaskId) return null
      const od = toPlainDate(data.occurrenceDate)
      if (!od) return null
      return { id: d.id, occurrenceDate: od }
    })
    .filter((t): t is { id: string; occurrenceDate: Date } => t !== null)
    .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())

  let created = 0

  for (const occDate of occurrenceDates) {
    // Find latest previous occurrence before occDate
    const occTime = occDate.getTime()
    let prevId: string | null = null
    for (let j = existingTasks.length - 1; j >= 0; j--) {
      if (existingTasks[j].occurrenceDate.getTime() < occTime) {
        prevId = existingTasks[j].id
        break
      }
    }

    const built = buildOccurrence(series, occDate, { previousTaskId: prevId })
    const wasCreated = await persistOccurrenceTransaction(built)
    if (!wasCreated) continue

    existingTasks.push({ id: built.taskId, occurrenceDate: occDate })
    existingTasks.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())
    created++
  }

  // Update series lastGeneratedDate
  if (created > 0) {
    const lastDate = occurrenceDates[occurrenceDates.length - 1]
    await updateDoc(doc(db(), SERIES_COLLECTION, series.id), {
      lastGeneratedDate: Timestamp.fromDate(lastDate),
      updatedAt: serverTimestamp(),
    })
  }

  return created
}

/**
 * Automatically generates the next occurrence when a task belonging to an 'after_completion'
 * series is marked as completed.
 *
 * Next date = completionDate + completionOffsetDays (adjusted for weekendPolicy if applicable).
 * Uses deterministic ID `${seriesId}_after_${previousTaskId}` and a transaction for idempotency.
 */
export async function generateNextCompletionOccurrence(task: Task): Promise<string | null> {
  if (task.parentTaskId || task.deletedAt || task.type !== 'occurrence') return null
  if (!task.seriesId) return null

  const seriesRef = doc(db(), SERIES_COLLECTION, task.seriesId)
  const seriesSnap = await getDoc(seriesRef)
  if (!seriesSnap.exists()) return null

  const series = { id: seriesSnap.id, ...seriesSnap.data() } as TaskSeries
  if (series.status !== 'active') return null
  if (series.recurrenceType !== 'after_completion') return null

  const nextDate = computeNextCompletionDate(series, task.completedAt)
  if (!nextDate) return null

  const docId = afterCompletionDocId(series.id, task.id)
  const built = buildOccurrence(series, nextDate, {
    previousTaskId: task.id,
    taskId: docId,
  })

  const created = await persistOccurrenceTransaction(built)
  if (created) {
    await updateDoc(seriesRef, {
      lastGeneratedDate: Timestamp.fromDate(nextDate),
      updatedAt: serverTimestamp(),
    })
  }

  return docId
}

/**
 * Manually trigger occurrence generation for a series immediately.
 * Ensures the task for the current period/window is generated and exists in Firestore.
 */
export async function triggerSeriesGenerationNow(seriesId: string): Promise<number> {
  const seriesRef = doc(db(), SERIES_COLLECTION, seriesId)
  const snap = await getDoc(seriesRef)
  if (!snap.exists()) {
    throw new Error('Không tìm thấy chuỗi định kỳ')
  }

  const series = { id: snap.id, ...snap.data() } as TaskSeries
  const now = new Date()
  const windowEnd = new Date(now.getTime() + (series.rollingWindowDays || 14) * 86400000)

  // Ensure windowStart encompasses now so current occurrence is generated
  return await generateSeriesOccurrences(series, windowEnd)
}

// ===== Google Calendar 3-Scope Mutator =====

export type RecurrenceMutationScope = 'this_only' | 'this_and_future' | 'all'

/**
 * Updates a recurring task according to the selected scope (Google Calendar model).
 *
 * Scopes:
 * - 'this_only': Detaches this occurrence (isDetached: true). Series & other occurrences unaffected.
 * - 'this_and_future': Closes old series right before this occurrence, spawns a new series starting from this occurrence, and updates future unclosed occurrences.
 * - 'all': Updates the series blueprint and updates all open, non-detached occurrences in the series.
 */
export async function updateRecurringTaskScoped(
  task: Task,
  scope: RecurrenceMutationScope,
  updates: Partial<Task>,
  actorId: string,
  actorName: string
): Promise<void> {
  if (!task.seriesId || scope === 'this_only') {
    // Just update this single task and mark it detached
    const taskRef = doc(db(), TASKS_COLLECTION, task.id)
    await updateDoc(taskRef, {
      ...updates,
      isDetached: true,
      updatedAt: serverTimestamp(),
    })
    return
  }

  const seriesRef = doc(db(), SERIES_COLLECTION, task.seriesId)
  const seriesSnap = await getDoc(seriesRef)
  if (!seriesSnap.exists()) {
    // If series not found, fallback to updating this task
    await updateDoc(doc(db(), TASKS_COLLECTION, task.id), {
      ...updates,
      updatedAt: serverTimestamp(),
    })
    return
  }

  const oldSeries = { id: seriesSnap.id, ...seriesSnap.data() } as TaskSeries
  const taskOccDate = task.occurrenceDate instanceof Timestamp
    ? task.occurrenceDate.toDate()
    : (task.occurrenceDate ? new Date(task.occurrenceDate as any) : new Date())

  if (scope === 'this_and_future') {
    // 1. Close old series before this occurrence
    const prevDay = new Date(taskOccDate.getTime() - 86400000)
    await updateDoc(seriesRef, {
      endDate: Timestamp.fromDate(prevDay),
      updatedAt: serverTimestamp(),
    })

    // 2. Create new series starting from this occurrence
    const newSeriesData: Omit<TaskSeries, 'id' | 'createdAt' | 'updatedAt' | 'lastGeneratedDate'> = {
      title: updates.title || oldSeries.title,
      description: (updates.description !== undefined ? updates.description : oldSeries.description) || null,
      recurrenceType: oldSeries.recurrenceType || 'calendar',
      completionOffsetDays: oldSeries.completionOffsetDays || 1,
      frequency: oldSeries.frequency,
      interval: oldSeries.interval,
      byWeekday: oldSeries.byWeekday || null,
      byMonthDay: oldSeries.byMonthDay || null,
      byMonth: oldSeries.byMonth || null,
      bySetPos: oldSeries.bySetPos !== undefined ? oldSeries.bySetPos : null,
      anchorDate: Timestamp.fromDate(taskOccDate),
      timezone: oldSeries.timezone || 'Asia/Ho_Chi_Minh',
      weekendPolicy: oldSeries.weekendPolicy || 'exact',
      occurrenceTime: oldSeries.occurrenceTime || null,
      dueOffsetMinutes: oldSeries.dueOffsetMinutes || 0,
      leadDays: oldSeries.leadDays || 0,
      status: 'active',
      startDate: Timestamp.fromDate(taskOccDate),
      endDate: oldSeries.endDate || null,
      misfirePolicy: normalizeMisfirePolicy(oldSeries.misfirePolicy),
      rollingWindowDays: oldSeries.rollingWindowDays || 14,
      defaultAssigneeId: updates.assigneeId !== undefined ? updates.assigneeId : oldSeries.defaultAssigneeId,
      defaultCollaboratorIds: updates.collaboratorIds || oldSeries.defaultCollaboratorIds,
      defaultFollowerIds: updates.followerIds || oldSeries.defaultFollowerIds,
      defaultPriority: updates.priority || oldSeries.defaultPriority,
      defaultEstimatedMinutes: updates.estimatedMinutes !== undefined ? updates.estimatedMinutes : oldSeries.defaultEstimatedMinutes,
      defaultDossierIds: updates.dossierIds || oldSeries.defaultDossierIds,
      defaultDocumentIds: updates.documentIds || oldSeries.defaultDocumentIds,
      defaultDepartmentId: updates.departmentId !== undefined ? updates.departmentId : oldSeries.defaultDepartmentId,
      defaultTagIds: updates.tagIds || oldSeries.defaultTagIds,
      defaultSubtasks: oldSeries.defaultSubtasks || [],
      templateId: oldSeries.templateId || null,
      previousSeriesId: oldSeries.id,
      createdBy: actorId,
    }

    const newSeriesRef = await addDoc(collection(db(), SERIES_COLLECTION), {
      ...newSeriesData,
      lastGeneratedDate: Timestamp.fromDate(taskOccDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const newSeriesId = newSeriesRef.id

    // 3. Update current task and future tasks of oldSeries
    const tasksSnap = await getDocs(query(
      collection(db(), TASKS_COLLECTION),
      where('seriesId', '==', oldSeries.id)
    ))

    const batch = writeBatch(db())
    const occTime = taskOccDate.getTime()

    for (const d of tasksSnap.docs) {
      const t = d.data() as Task
      if (t.isClosed || t.isDetached) continue
      const tOcc = t.occurrenceDate instanceof Timestamp
        ? t.occurrenceDate.toDate()
        : (t.occurrenceDate ? new Date(t.occurrenceDate as any) : null)
      if (tOcc && tOcc.getTime() >= occTime) {
        batch.update(d.ref, {
          ...updates,
          seriesId: newSeriesId,
          updatedAt: serverTimestamp(),
        })
      }
    }

    await batch.commit()
    return
  }

  if (scope === 'all') {
    // 1. Update series blueprint
    const seriesUpdates: Partial<TaskSeries> = {
      updatedAt: serverTimestamp() as any,
    }
    if (updates.title) seriesUpdates.title = updates.title
    if (updates.description !== undefined) seriesUpdates.description = updates.description
    if (updates.priority) seriesUpdates.defaultPriority = updates.priority
    if (updates.assigneeId !== undefined) seriesUpdates.defaultAssigneeId = updates.assigneeId
    if (updates.departmentId !== undefined) seriesUpdates.defaultDepartmentId = updates.departmentId
    if (updates.tagIds) seriesUpdates.defaultTagIds = updates.tagIds

    await updateDoc(seriesRef, seriesUpdates)

    // 2. Batch update unclosed non-detached tasks
    const tasksSnap = await getDocs(query(
      collection(db(), TASKS_COLLECTION),
      where('seriesId', '==', oldSeries.id)
    ))

    const batch = writeBatch(db())
    for (const d of tasksSnap.docs) {
      const t = d.data() as Task
      if (t.isClosed || t.isDetached) continue
      batch.update(d.ref, {
        ...updates,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

/**
 * Deletes/Cancels a recurring task according to the selected scope (Google Calendar model).
 */
export async function deleteRecurringTaskScoped(
  task: Task,
  scope: RecurrenceMutationScope,
  actorId: string
): Promise<void> {
  if (!task.seriesId || scope === 'this_only') {
    // Soft delete this single task
    await updateDoc(doc(db(), TASKS_COLLECTION, task.id), {
      isClosed: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return
  }

  const seriesRef = doc(db(), SERIES_COLLECTION, task.seriesId)
  const taskOccDate = task.occurrenceDate instanceof Timestamp
    ? task.occurrenceDate.toDate()
    : (task.occurrenceDate ? new Date(task.occurrenceDate as any) : new Date())

  if (scope === 'this_and_future') {
    // End old series right before this occurrence
    const prevDay = new Date(taskOccDate.getTime() - 86400000)
    await updateDoc(seriesRef, {
      endDate: Timestamp.fromDate(prevDay),
      updatedAt: serverTimestamp(),
    })

    // Soft delete this occurrence and all future ones
    const tasksSnap = await getDocs(query(
      collection(db(), TASKS_COLLECTION),
      where('seriesId', '==', task.seriesId)
    ))

    const occTime = taskOccDate.getTime()
    const batch = writeBatch(db())
    for (const d of tasksSnap.docs) {
      const t = d.data() as Task
      const tOcc = t.occurrenceDate instanceof Timestamp
        ? t.occurrenceDate.toDate()
        : (t.occurrenceDate ? new Date(t.occurrenceDate as any) : null)
      if (tOcc && tOcc.getTime() >= occTime && !t.isClosed) {
        batch.update(d.ref, {
          isClosed: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
    }
    await batch.commit()
    return
  }

  if (scope === 'all') {
    // End series
    await updateDoc(seriesRef, {
      status: 'ended',
      endDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Soft delete all open occurrences of series
    const tasksSnap = await getDocs(query(
      collection(db(), TASKS_COLLECTION),
      where('seriesId', '==', task.seriesId)
    ))

    const batch = writeBatch(db())
    for (const d of tasksSnap.docs) {
      const t = d.data() as Task
      if (!t.isClosed) {
        batch.update(d.ref, {
          isClosed: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
    }
    await batch.commit()
  }
}
