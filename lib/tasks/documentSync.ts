import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DocumentStatus } from '@/types'
import type { Task } from '@/types/tasks'

const DOCUMENTS_COLLECTION = 'documents'
const TASKS_COLLECTION = 'tasks'

/**
 * Pure function to derive DocumentStatus from its linked tasks.
 * Returns null if the document status should not be changed.
 *
 * Rules:
 * - Only considers root tasks (parentTaskId == null) that are not soft-deleted (deletedAt == null).
 * - If current is 'uploading' or 'upload_failed' -> null.
 * - If no active linked root tasks -> null (do not revert automatically).
 * - If >= 1 open task ('pending' | 'in_progress' | 'blocked') -> 'in_progress' (even if document was 'completed').
 * - If all tasks are closed and >= 1 'completed' -> 'completed'.
 * - If all tasks are 'cancelled' -> null.
 */
export function deriveDocumentStatus(
  current: DocumentStatus,
  linkedTasks: Pick<Task, 'status' | 'deletedAt' | 'parentTaskId'>[]
): DocumentStatus | null {
  if (current === 'uploading' || current === 'upload_failed') {
    return null
  }

  const rootActiveTasks = linkedTasks.filter(
    t => t.parentTaskId == null && !t.deletedAt
  )

  if (rootActiveTasks.length === 0) {
    return null
  }

  const hasOpenTask = rootActiveTasks.some(
    t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked'
  )
  if (hasOpenTask) {
    return 'in_progress'
  }

  const hasCompletedTask = rootActiveTasks.some(t => t.status === 'completed')
  if (hasCompletedTask) {
    return 'completed'
  }

  // All tasks are 'cancelled'
  return null
}

/**
 * Pure helper to compute added, removed, and all affected document IDs when a task's documentIds change.
 */
export function diffDocumentIds(
  prevDocIds: string[] | null | undefined,
  nextDocIds: string[] | null | undefined
): { added: string[]; removed: string[]; affected: string[] } {
  const prevSet = new Set((prevDocIds ?? []).filter(Boolean))
  const nextSet = new Set((nextDocIds ?? []).filter(Boolean))

  const added: string[] = []
  const removed: string[] = []

  for (const id of nextSet) {
    if (!prevSet.has(id)) added.push(id)
  }
  for (const id of prevSet) {
    if (!nextSet.has(id)) removed.push(id)
  }

  const affected = Array.from(new Set([...added, ...removed]))
  return { added, removed, affected }
}

/**
 * Update two-way `taskIds` on documents using arrayUnion / arrayRemove.
 * Errors are logged with console.warn and never fail the primary task mutation.
 */
export async function syncDocumentTaskLinks(
  taskId: string,
  addedDocIds: string[] = [],
  removedDocIds: string[] = []
): Promise<void> {
  const uniqueAdded = Array.from(new Set(addedDocIds.filter(Boolean)))
  const uniqueRemoved = Array.from(new Set(removedDocIds.filter(Boolean)))

  for (const docId of uniqueAdded) {
    try {
      await updateDoc(doc(db(), DOCUMENTS_COLLECTION, docId), {
        taskIds: arrayUnion(taskId),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn(`[documentSync] Failed to link taskId ${taskId} to document ${docId}:`, err)
    }
  }

  for (const docId of uniqueRemoved) {
    try {
      await updateDoc(doc(db(), DOCUMENTS_COLLECTION, docId), {
        taskIds: arrayRemove(taskId),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn(`[documentSync] Failed to unlink taskId ${taskId} from document ${docId}:`, err)
    }
  }
}

/**
 * Synchronize the status and completedDate of documents based on their currently linked tasks.
 * Errors are logged with console.warn so they do not break the caller's main operation.
 */
export async function syncDocumentsFromTasks(docIds: string[]): Promise<void> {
  const uniqueDocIds = Array.from(new Set((docIds || []).filter(Boolean)))
  if (uniqueDocIds.length === 0) return

  for (const docId of uniqueDocIds) {
    try {
      const docRef = doc(db(), DOCUMENTS_COLLECTION, docId)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) continue

      const docData = docSnap.data()
      const currentStatus = (docData.status || 'pending') as DocumentStatus

      const tasksQuery = query(
        collection(db(), TASKS_COLLECTION),
        where('documentIds', 'array-contains', docId)
      )
      const tasksSnap = await getDocs(tasksQuery)
      const linkedTasks = tasksSnap.docs.map(d => {
        const data = d.data()
        return {
          status: data.status,
          deletedAt: data.deletedAt ?? null,
          parentTaskId: data.parentTaskId ?? null,
        } as Pick<Task, 'status' | 'deletedAt' | 'parentTaskId'>
      })

      const nextStatus = deriveDocumentStatus(currentStatus, linkedTasks)
      if (nextStatus && nextStatus !== currentStatus) {
        const updatePayload: Record<string, any> = {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        }
        if (nextStatus === 'completed') {
          updatePayload.completedDate = serverTimestamp()
        } else if (currentStatus === 'completed' || docData.completedDate) {
          updatePayload.completedDate = null
        }

        await updateDoc(docRef, updatePayload)
      }
    } catch (err) {
      console.warn(`[documentSync] Failed to sync status for document ${docId}:`, err)
    }
  }
}
