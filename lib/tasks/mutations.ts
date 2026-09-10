/**
 * Task mutations — client-side wrappers that call Cloud Functions.
 *
 * IMPORTANT: All mutations go through server-side Cloud Functions to ensure:
 * - Atomic writes (Task + Activity + Outbox + Stats in one transaction)
 * - RBAC enforcement
 * - State machine validation
 * - Notification outbox population
 *
 * If Cloud Functions are not deployed yet, these fall back to direct Firestore writes
 * for development convenience. Set NEXT_PUBLIC_USE_CF_MUTATIONS=true to enforce CF-only.
 */

import {
  collection, doc, addDoc, updateDoc, serverTimestamp,
  writeBatch, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { computeIsClosed } from './validation'
import { queueNotification } from './notifications'
import type {
  CreateTaskInput, UpdateTaskInput, TaskStatus, TaskPriority,
} from '@/types/tasks'

const TASKS = 'tasks'
const TASK_COMMENTS = 'taskComments'
const TASK_ACTIVITIES = 'taskActivities'

// ===== Development Fallback (direct Firestore writes) =====
// These will be replaced by CF callable wrappers when deployed.

export async function createTask(
  input: CreateTaskInput,
  actorId: string,
  actorName: string
): Promise<string> {
  const batch = writeBatch(db())
  const taskRef = doc(collection(db(), TASKS))
  const now = serverTimestamp()

  const status: TaskStatus = 'pending'

  batch.set(taskRef, {
    taskCode: null,
    title: input.title,
    description: input.description ?? null,
    type: 'single',
    status,
    priority: input.priority ?? 'normal',
    progress: 0,
    progressMode: 'manual',
    isClosed: false,
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    completedAt: null,
    estimatedMinutes: null,
    occurrenceDate: null,
    visibleFrom: null,
    createdBy: actorId,
    assigneeId: input.assigneeId ?? null,
    assigneeName: input.assigneeName ?? null,
    collaboratorIds: input.collaboratorIds ?? [],
    followerIds: input.followerIds ?? [],
    departmentId: input.departmentId ?? null,
    cooperatingDepartmentIds: input.cooperatingDepartmentIds ?? [],
    assigneeDepartmentId: null,
    blockedReason: null,
    blockedByTaskIds: [],
    blockedNote: null,
    previousStatus: null,
    dossierIds: input.dossierIds ?? [],
    documentIds: input.documentIds ?? [],
    parentTaskId: input.parentTaskId ?? null,
    dependsOnTaskIds: [],
    relatedTaskIds: [],
    seriesId: null,
    occurrenceKey: null,
    templateId: null,
    tagIds: input.tagIds ?? [],
    attachments: [],
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    migratedFromChecklistId: null,
  })

  // Activity log
  const activityRef = doc(collection(db(), TASK_ACTIVITIES))
  batch.set(activityRef, {
    taskId: taskRef.id,
    actorId,
    actorName,
    eventType: 'CREATED',
    metadata: { title: input.title },
    createdAt: now,
  })

  // Notification for assignee
  if (input.assigneeId && input.assigneeId !== actorId) {
    queueNotification(batch, {
      recipientId: input.assigneeId,
      category: 'TASK_ASSIGNED',
      entityType: 'task',
      entityId: taskRef.id,
      title: 'Công việc mới được giao',
      body: `${actorName} đã giao cho bạn: "${input.title}"`,
      actorId,
      actorName,
    })
  }

  await batch.commit()
  return taskRef.id
}

export async function updateTask(
  taskId: string,
  fields: UpdateTaskInput,
  actorId: string,
  actorName: string
): Promise<void> {
  const batch = writeBatch(db())
  const taskRef = doc(db(), TASKS, taskId)

  const updateData: Record<string, any> = {
    ...fields,
    updatedAt: serverTimestamp(),
  }

  batch.update(taskRef, updateData)

  // Activity for key field changes
  const trackedFields = ['title', 'priority', 'dueDate', 'assigneeId'] as const
  for (const field of trackedFields) {
    if (field in fields) {
      const activityRef = doc(collection(db(), TASK_ACTIVITIES))
      const eventType =
        field === 'priority' ? 'PRIORITY_CHANGED' :
        field === 'dueDate' ? 'DEADLINE_CHANGED' :
        field === 'assigneeId' ? 'REASSIGNED' :
        'STATUS_CHANGED'
      batch.set(activityRef, {
        taskId,
        actorId,
        actorName,
        eventType,
        metadata: { field, value: (fields as any)[field] },
        createdAt: serverTimestamp(),
      })
    }
  }

  await batch.commit()
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  actorId: string,
  actorName: string,
  blockedNote?: string
): Promise<void> {
  const batch = writeBatch(db())
  const taskRef = doc(db(), TASKS, taskId)

  const updateData: Record<string, any> = {
    status: newStatus,
    isClosed: computeIsClosed(newStatus),
    updatedAt: serverTimestamp(),
  }

  if (newStatus === 'completed') {
    updateData.completedAt = serverTimestamp()
    updateData.progress = 100
  }

  if (newStatus === 'blocked' && blockedNote) {
    updateData.blockedReason = 'manual'
    updateData.blockedNote = blockedNote
  }

  // When unblocking (moving from blocked to another status)
  if (newStatus !== 'blocked') {
    updateData.blockedReason = null
    updateData.blockedNote = null
    updateData.blockedByTaskIds = []
  }

  batch.update(taskRef, updateData)

  // Activity
  const activityRef = doc(collection(db(), TASK_ACTIVITIES))
  const eventType = newStatus === 'completed' ? 'COMPLETED' :
    newStatus === 'blocked' ? 'BLOCKED' :
    (newStatus === 'pending' ? 'REOPENED' : 'STATUS_CHANGED')

  batch.set(activityRef, {
    taskId,
    actorId,
    actorName,
    eventType,
    metadata: { newStatus, blockedNote },
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function addTaskComment(
  taskId: string,
  content: string,
  actorId: string,
  actorName: string,
  mentions: string[] = []
): Promise<string> {
  const batch = writeBatch(db())
  const commentRef = doc(collection(db(), TASK_COMMENTS))

  batch.set(commentRef, {
    taskId,
    authorId: actorId,
    authorName: actorName,
    content,
    mentions,
    attachments: [],
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Activity
  const activityRef = doc(collection(db(), TASK_ACTIVITIES))
  batch.set(activityRef, {
    taskId,
    actorId,
    actorName,
    eventType: 'COMMENT_ADDED',
    metadata: { commentId: commentRef.id, preview: content.slice(0, 100) },
    createdAt: serverTimestamp(),
  })

  // Notifications for mentioned users
  for (const recipientId of mentions) {
    if (recipientId !== actorId) {
      queueNotification(batch, {
        recipientId,
        category: 'MENTIONED',
        entityType: 'task',
        entityId: taskId,
        title: `${actorName} đã nhắc đến bạn`,
        body: content.slice(0, 100),
        actorId,
        actorName,
      })
    }
  }

  // Update task's updatedAt
  batch.update(doc(db(), TASKS, taskId), { updatedAt: serverTimestamp() })

  await batch.commit()
  return commentRef.id
}

export async function deleteTask(
  taskId: string,
  actorId: string
): Promise<void> {
  // Soft delete
  await updateDoc(doc(db(), TASKS, taskId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
