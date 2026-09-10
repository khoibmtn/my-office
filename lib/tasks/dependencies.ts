/**
 * Task dependency resolution & auto-unblock logic.
 *
 * Implements ADR-07: Auto-unblock for dependency.
 * When a prerequisite task is completed, any dependent tasks that were blocked
 * exclusively due to dependencies are automatically unblocked and restored.
 */

import {
  collection, doc, getDoc, getDocs, query, where,
  writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Task } from '@/types/tasks'

const TASKS = 'tasks'
const TASK_ACTIVITIES = 'taskActivities'

/**
 * Fetch a list of tasks by their IDs.
 */
export async function getTasksByIds(taskIds: string[]): Promise<Task[]> {
  if (!taskIds.length) return []
  const tasks: Task[] = []

  // Fetch individually or in chunks
  for (const id of taskIds) {
    try {
      const snap = await getDoc(doc(db(), TASKS, id))
      if (snap.exists() && !snap.data().deletedAt) {
        tasks.push({ id: snap.id, ...snap.data() } as Task)
      }
    } catch (e) {
      console.warn(`Failed to fetch task dependency ${id}:`, e)
    }
  }

  return tasks
}

/**
 * Check if all tasks in dependsOnTaskIds are completed.
 */
export async function checkDependenciesCompleted(dependsOnTaskIds: string[]): Promise<{
  allCompleted: boolean
  pendingTaskIds: string[]
  pendingTasks: Task[]
}> {
  if (!dependsOnTaskIds.length) {
    return { allCompleted: true, pendingTaskIds: [], pendingTasks: [] }
  }

  const tasks = await getTasksByIds(dependsOnTaskIds)
  const pendingTasks = tasks.filter(t => t.status !== 'completed')
  const pendingTaskIds = pendingTasks.map(t => t.id)

  return {
    allCompleted: pendingTasks.length === 0,
    pendingTaskIds,
    pendingTasks,
  }
}

/**
 * When a task is completed, find any tasks blocked by this task,
 * verify if all their dependencies are now satisfied, and auto-unblock them.
 *
 * Returns list of unblocked task IDs.
 */
export async function resolveBlockedDependencies(
  completedTaskId: string,
  actorId: string,
  actorName: string
): Promise<string[]> {
  const unblockedIds: string[] = []

  try {
    // Query all tasks that declare completedTaskId in dependsOnTaskIds
    const q = query(
      collection(db(), TASKS),
      where('dependsOnTaskIds', 'array-contains', completedTaskId)
    )
    const snap = await getDocs(q)
    if (snap.empty) return []

    const candidates = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Task))
      .filter(t => !t.deletedAt && t.status === 'blocked')

    for (const candidate of candidates) {
      // Check if all its dependencies are now completed
      const check = await checkDependenciesCompleted(candidate.dependsOnTaskIds || [])
      if (check.allCompleted) {
        const batch = writeBatch(db())
        const taskRef = doc(db(), TASKS, candidate.id)

        const restoredStatus = candidate.previousStatus || 'pending'

        batch.update(taskRef, {
          status: restoredStatus,
          blockedReason: null,
          blockedByTaskIds: [],
          blockedNote: null,
          updatedAt: serverTimestamp(),
        })

        // Log activity
        const activityRef = doc(collection(db(), TASK_ACTIVITIES))
        batch.set(activityRef, {
          taskId: candidate.id,
          actorId,
          actorName,
          eventType: 'STATUS_CHANGED',
          metadata: {
            previousStatus: 'blocked',
            newStatus: restoredStatus,
            autoUnblocked: true,
            completedPrerequisiteTaskId: completedTaskId,
            note: `Tự động mở khóa vì công việc tiên quyết (${completedTaskId}) đã hoàn thành`,
          },
          createdAt: serverTimestamp(),
        })

        await batch.commit()
        unblockedIds.push(candidate.id)
      }
    }
  } catch (err) {
    console.error('Error resolving blocked dependencies:', err)
  }

  return unblockedIds
}
