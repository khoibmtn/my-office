/**
 * TaskSeries Firestore queries and mutations.
 * Manages recurring task series lifecycle.
 */

import {
  collection, doc, query, where, orderBy, limit,
  onSnapshot, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  serverTimestamp, writeBatch, Timestamp, WriteBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateOccurrences, occurrenceDocId, applyWeekendPolicy } from '@/lib/recurrence/generate'
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

/**
 * Helper to add an occurrence and its subtask templates into a Firestore batch.
 */
function addOccurrenceToBatch(
  batch: WriteBatch,
  series: TaskSeries,
  occDate: Date,
  previousTaskId: string | null
): string {
  const docId = occurrenceDocId(series.id, occDate)
  const taskRef = doc(db(), TASKS_COLLECTION, docId)
  const leadMs = (series.leadDays || 0) * 86400000
  const dueOffsetMs = (series.dueOffsetMinutes || 0) * 60000
  const occKey = `${series.id}:${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, '0')}-${String(occDate.getDate()).padStart(2, '0')}`

  const taskData: Omit<Task, 'id'> = {
    taskCode: null,
    title: series.title,
    description: series.description || '',
    type: 'occurrence',
    status: 'pending',
    priority: series.defaultPriority || 'normal',
    progress: 0,
    progressMode: 'manual',
    isClosed: false,

    startDate: null,
    dueDate: Timestamp.fromDate(new Date(occDate.getTime() + dueOffsetMs)),
    completedAt: null,
    estimatedMinutes: series.defaultEstimatedMinutes || null,
    occurrenceDate: Timestamp.fromDate(occDate),
    visibleFrom: leadMs > 0 ? Timestamp.fromDate(new Date(occDate.getTime() - leadMs)) : null,

    createdBy: series.createdBy,
    assigneeId: series.defaultAssigneeId || null,
    assigneeName: null,
    collaboratorIds: series.defaultCollaboratorIds || [],
    followerIds: series.defaultFollowerIds || [],

    departmentId: series.defaultDepartmentId || null,
    cooperatingDepartmentIds: [],
    assigneeDepartmentId: series.defaultDepartmentId || null,

    blockedReason: null,
    blockedByTaskIds: [],
    blockedNote: null,
    previousStatus: null,

    dossierIds: series.defaultDossierIds || [],
    documentIds: series.defaultDocumentIds || [],
    parentTaskId: null,
    dependsOnTaskIds: [],
    relatedTaskIds: [],

    seriesId: series.id,
    occurrenceKey: occKey,
    templateId: series.templateId || null,

    tagIds: series.defaultTagIds || [],
    attachments: [],
    source: 'recurring',

    previousTaskId: previousTaskId || null,
    isDetached: false,

    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
    deletedAt: null,
    migratedFromChecklistId: null,
  }

  batch.set(taskRef, taskData)

  // Subtask template cloning
  if (series.defaultSubtasks && Array.isArray(series.defaultSubtasks) && series.defaultSubtasks.length > 0) {
    for (const st of series.defaultSubtasks) {
      const subtaskRef = doc(collection(db(), TASKS_COLLECTION))
      const subtaskData: Omit<Task, 'id'> = {
        taskCode: null,
        title: st.title,
        description: st.description || null,
        type: 'single',
        status: 'pending',
        priority: series.defaultPriority || 'normal',
        progress: 0,
        progressMode: 'manual',
        isClosed: false,

        startDate: null,
        dueDate: Timestamp.fromDate(new Date(occDate.getTime() + dueOffsetMs)),
        completedAt: null,
        estimatedMinutes: st.estimatedMinutes || null,
        occurrenceDate: Timestamp.fromDate(occDate),
        visibleFrom: null,

        createdBy: series.createdBy,
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

        dossierIds: series.defaultDossierIds || [],
        documentIds: series.defaultDocumentIds || [],
        parentTaskId: docId,
        dependsOnTaskIds: [],
        relatedTaskIds: [],

        seriesId: series.id,
        occurrenceKey: `${occKey}:subtask:${st.order}`,
        templateId: null,

        tagIds: series.defaultTagIds || [],
        attachments: [],
        source: 'recurring',

        previousTaskId: null,
        isDetached: false,

        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        deletedAt: null,
        migratedFromChecklistId: null,
      }
      batch.set(subtaskRef, subtaskData)
    }
  }

  return docId
}

/**
 * Generate occurrences for a single series within a rolling window.
 * Uses deterministic document IDs for idempotency.
 *
 * Returns count of newly created occurrences.
 */
export async function generateSeriesOccurrences(
  series: TaskSeries,
  windowEnd: Date
): Promise<number> {
  if (series.status !== 'active') return 0

  // Handle after_completion series
  if (series.recurrenceType === 'after_completion') {
    // For completion-based series, occurrences only spawn sequentially upon completion.
    // If no occurrence exists yet, generate the initial occurrence at startDate.
    const existingSnap = await getDocs(query(
      collection(db(), TASKS_COLLECTION),
      where('seriesId', '==', series.id)
    ))
    if (!existingSnap.empty) {
      return 0
    }

    const start = series.startDate instanceof Timestamp
      ? series.startDate.toDate()
      : new Date(series.startDate as any)
    let occDate = new Date(start)
    if (series.weekendPolicy && series.weekendPolicy !== 'exact') {
      occDate = applyWeekendPolicy(occDate, series.weekendPolicy)
    }

    const batch = writeBatch(db())
    addOccurrenceToBatch(batch, series, occDate, null)
    await batch.commit()

    await updateDoc(doc(db(), SERIES_COLLECTION, series.id), {
      lastGeneratedDate: Timestamp.fromDate(occDate),
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
    anchorDate: series.anchorDate instanceof Timestamp
      ? series.anchorDate.toDate()
      : new Date(series.anchorDate as any),
    timezone: series.timezone || 'Asia/Ho_Chi_Minh',
  }

  // Determine window start
  let windowStart: Date
  if (series.lastGeneratedDate) {
    const last = series.lastGeneratedDate instanceof Timestamp
      ? series.lastGeneratedDate.toDate()
      : new Date(series.lastGeneratedDate as any)
    windowStart = new Date(last.getTime() + 86400000) // next day
  } else if (series.startDate) {
    windowStart = series.startDate instanceof Timestamp
      ? series.startDate.toDate()
      : new Date(series.startDate as any)
  } else {
    windowStart = new Date()
  }

  // Check endDate
  if (series.endDate) {
    const end = series.endDate instanceof Timestamp
      ? series.endDate.toDate()
      : new Date(series.endDate as any)
    if (windowStart > end) return 0
    if (windowEnd > end) windowEnd = end
  }

  // Generate dates
  const occurrenceDates = generateOccurrences(rule, windowStart, windowEnd)
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
      const od = data.occurrenceDate instanceof Timestamp
        ? data.occurrenceDate.toDate()
        : (data.occurrenceDate ? new Date(data.occurrenceDate) : null)
      if (!od) return null
      return { id: d.id, occurrenceDate: od }
    })
    .filter((t): t is { id: string; occurrenceDate: Date } => t !== null)
    .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())

  let created = 0

  // Process in batches of 25 occurrences to stay well within 500 operations
  for (let i = 0; i < occurrenceDates.length; i += 25) {
    const batch = writeBatch(db())
    const chunk = occurrenceDates.slice(i, i + 25)

    for (const occDate of chunk) {
      const docId = occurrenceDocId(series.id, occDate)
      const taskRef = doc(db(), TASKS_COLLECTION, docId)

      // Check if already exists (idempotency)
      const existing = await getDoc(taskRef)
      if (existing.exists()) continue

      // Find latest previous occurrence before occDate
      const occTime = occDate.getTime()
      let prevId: string | null = null
      for (let j = existingTasks.length - 1; j >= 0; j--) {
        if (existingTasks[j].occurrenceDate.getTime() < occTime) {
          prevId = existingTasks[j].id
          break
        }
      }

      addOccurrenceToBatch(batch, series, occDate, prevId)
      existingTasks.push({ id: docId, occurrenceDate: occDate })
      existingTasks.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())
      created++
    }

    await batch.commit()
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
 * Links the newly created task to the completed task via previousTaskId.
 */
export async function generateNextCompletionOccurrence(task: Task): Promise<string | null> {
  if (!task.seriesId) return null

  const seriesRef = doc(db(), SERIES_COLLECTION, task.seriesId)
  const seriesSnap = await getDoc(seriesRef)
  if (!seriesSnap.exists()) return null

  const series = { id: seriesSnap.id, ...seriesSnap.data() } as TaskSeries
  if (series.status !== 'active') return null
  if (series.recurrenceType !== 'after_completion') return null

  // Calculate next date from completedAt or current time
  const completedDate = task.completedAt instanceof Timestamp
    ? task.completedAt.toDate()
    : (task.completedAt ? new Date(task.completedAt as any) : new Date())

  const offsetDays = (series.completionOffsetDays && series.completionOffsetDays > 0)
    ? series.completionOffsetDays
    : (series.interval || 1)

  let nextDate = new Date(completedDate.getTime() + offsetDays * 86400000)

  // Apply weekend policy if set
  if (series.weekendPolicy && series.weekendPolicy !== 'exact') {
    nextDate = applyWeekendPolicy(nextDate, series.weekendPolicy)
  }

  // Check endDate
  if (series.endDate) {
    const end = series.endDate instanceof Timestamp
      ? series.endDate.toDate()
      : new Date(series.endDate as any)
    if (nextDate > end) return null
  }

  const docId = occurrenceDocId(series.id, nextDate)
  const taskRef = doc(db(), TASKS_COLLECTION, docId)
  const existing = await getDoc(taskRef)
  if (existing.exists()) {
    return existing.id
  }

  const batch = writeBatch(db())
  addOccurrenceToBatch(batch, series, nextDate, task.id)
  await batch.commit()

  await updateDoc(doc(db(), SERIES_COLLECTION, series.id), {
    lastGeneratedDate: Timestamp.fromDate(nextDate),
    updatedAt: serverTimestamp(),
  })

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
