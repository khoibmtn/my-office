/**
 * Task Firestore read queries.
 * All mutations go through Cloud Functions callables (see mutations.ts).
 * These are READ-ONLY query builders and direct reads.
 */

import {
  collection, doc, getDoc, getDocs, query,
  where, orderBy, limit, onSnapshot,
  type Query, type DocumentData,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Task, TaskComment, TaskActivity } from '@/types/tasks'

const TASKS = 'tasks'
const TASK_COMMENTS = 'taskComments'
const TASK_ACTIVITIES = 'taskActivities'

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

/** All tasks */
export function queryAllActiveTasks(): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    orderBy('createdAt', 'desc')
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

/** Subtasks of a parent task */
export function querySubtasks(parentTaskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('parentTaskId', '==', parentTaskId)
  )
}

/** Overdue tasks */
export function queryOverdueTasks(assigneeId?: string): Query<DocumentData> {
  if (assigneeId) {
    return query(collection(db(), TASKS), where('assigneeId', '==', assigneeId))
  }
  return query(collection(db(), TASKS), orderBy('createdAt', 'desc'))
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
  since?: Date,
  assigneeId?: string,
  maxResults: number = 50
): Query<DocumentData> {
  if (assigneeId) {
    return query(collection(db(), TASKS), where('assigneeId', '==', assigneeId))
  }
  return query(collection(db(), TASKS), where('status', '==', 'completed'))
}

// ===== Comments & Activities =====

export function queryTaskComments(taskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASK_COMMENTS),
    where('taskId', '==', taskId)
  )
}

export function queryTaskActivities(taskId: string, maxResults: number = 50): Query<DocumentData> {
  return query(
    collection(db(), TASK_ACTIVITIES),
    where('taskId', '==', taskId)
  )
}

// ===== Real-time Subscriptions =====

export function subscribeToQuery(
  q: Query<DocumentData>,
  onData: (items: any[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    q,
    (snap) => {
      let items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Exclude soft-deleted
      items = items.filter((item: any) => !item.deletedAt)
      onData(items)
    },
    (err) => {
      console.error('[tasks/firestore] snapshot error:', err)
      onError?.(err)
    }
  )
}
