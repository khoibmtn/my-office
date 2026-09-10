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

/** My Tasks: assigned to me, not closed, ordered by priority then due date */
export function queryMyTasks(assigneeId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('assigneeId', '==', assigneeId),
    where('isClosed', '==', false),
    where('deletedAt', '==', null),
    orderBy('dueDate', 'asc')
  )
}

/** Tasks by department, not closed */
export function queryDepartmentTasks(departmentId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('departmentId', '==', departmentId),
    where('isClosed', '==', false),
    where('deletedAt', '==', null),
    orderBy('dueDate', 'asc')
  )
}

/** All active tasks (admin view), not closed */
export function queryAllActiveTasks(): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('isClosed', '==', false),
    where('deletedAt', '==', null),
    orderBy('updatedAt', 'desc')
  )
}

/** Tasks linked to a specific dossier */
export function queryDossierTasks(dossierId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('dossierIds', 'array-contains', dossierId),
    where('deletedAt', '==', null),
    orderBy('createdAt', 'desc')
  )
}

/** Tasks linked to a specific document */
export function queryDocumentTasks(documentId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('documentIds', 'array-contains', documentId),
    where('deletedAt', '==', null),
    orderBy('createdAt', 'desc')
  )
}

/** Subtasks of a parent task */
export function querySubtasks(parentTaskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('parentTaskId', '==', parentTaskId),
    where('deletedAt', '==', null),
    orderBy('createdAt', 'asc')
  )
}

/** Overdue tasks: past due, not closed */
export function queryOverdueTasks(assigneeId?: string): Query<DocumentData> {
  const now = new Date()
  const constraints = [
    where('isClosed', '==', false),
    where('deletedAt', '==', null),
    where('dueDate', '<', now),
    orderBy('dueDate', 'asc'),
  ]
  if (assigneeId) {
    constraints.unshift(where('assigneeId', '==', assigneeId))
  }
  return query(collection(db(), TASKS), ...constraints)
}

/** Tasks created by a specific user */
export function queryCreatedByTasks(createdBy: string): Query<DocumentData> {
  return query(
    collection(db(), TASKS),
    where('createdBy', '==', createdBy),
    where('deletedAt', '==', null),
    orderBy('createdAt', 'desc')
  )
}

/** Completed tasks in a date range */
export function queryCompletedTasks(
  since: Date,
  assigneeId?: string,
  maxResults: number = 50
): Query<DocumentData> {
  const constraints = [
    where('status', '==', 'completed'),
    where('completedAt', '>=', since),
    where('deletedAt', '==', null),
    orderBy('completedAt', 'desc'),
    limit(maxResults),
  ]
  if (assigneeId) {
    constraints.unshift(where('assigneeId', '==', assigneeId))
  }
  return query(collection(db(), TASKS), ...constraints)
}

// ===== Comments & Activities =====

export function queryTaskComments(taskId: string): Query<DocumentData> {
  return query(
    collection(db(), TASK_COMMENTS),
    where('taskId', '==', taskId),
    where('deletedAt', '==', null),
    orderBy('createdAt', 'asc')
  )
}

export function queryTaskActivities(taskId: string, maxResults: number = 50): Query<DocumentData> {
  return query(
    collection(db(), TASK_ACTIVITIES),
    where('taskId', '==', taskId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
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
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    },
    (err) => {
      console.error('[tasks/firestore] snapshot error:', err)
      onError?.(err)
    }
  )
}
