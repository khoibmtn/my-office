/**
 * TaskSeries Firestore queries and mutations.
 * Manages recurring task series lifecycle.
 */

import {
  collection, doc, query, where, orderBy, limit,
  onSnapshot, addDoc, updateDoc, deleteDoc, getDoc,
  serverTimestamp, writeBatch, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateOccurrences, occurrenceDocId } from '@/lib/recurrence/generate'
import type { RecurrenceRule } from '@/lib/recurrence/types'
import type { TaskSeries, Task } from '@/types/tasks'

const SERIES_COLLECTION = 'taskSeries'
const TASKS_COLLECTION = 'tasks'

// ===== Queries =====

export function queryActiveSeries() {
  return query(
    collection(db(), SERIES_COLLECTION),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  )
}

export function querySeriesByDepartment(departmentId: string) {
  return query(
    collection(db(), SERIES_COLLECTION),
    where('defaultDepartmentId', '==', departmentId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
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

  const rule: RecurrenceRule = {
    frequency: series.frequency,
    interval: series.interval,
    byWeekday: series.byWeekday ? series.byWeekday : undefined,
    byMonthDay: series.byMonthDay ? series.byMonthDay : undefined,
    byMonth: series.byMonth ? series.byMonth : undefined,
    bySetPos: series.bySetPos !== null ? series.bySetPos : undefined,
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

  let created = 0

  // Process in batches of 100
  for (let i = 0; i < occurrenceDates.length; i += 100) {
    const batch = writeBatch(db())
    const chunk = occurrenceDates.slice(i, i + 100)

    for (const occDate of chunk) {
      const docId = occurrenceDocId(series.id, occDate)
      const taskRef = doc(db(), TASKS_COLLECTION, docId)

      // Check if already exists (idempotency)
      const existing = await getDoc(taskRef)
      if (existing.exists()) continue

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

        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        deletedAt: null,
        migratedFromChecklistId: null,
      }

      batch.set(taskRef, taskData)
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
