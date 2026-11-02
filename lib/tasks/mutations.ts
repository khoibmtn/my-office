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
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  computeIsClosed,
  validateStatusChange,
  validateDependencyList,
  hasIncompleteSubtasksFromList,
  computeParentSubtaskProgress,
} from './validation'
import {
  canChangeStatus,
  canAssignTask,
  normalizeTaskActorRole,
  type StaffContext,
  type TaskContext,
} from './permissions'
import { queueNotification } from './notifications'
import {
  checkDependenciesCompleted,
  resolveBlockedDependencies,
  getTasksByIds,
} from './dependencies'
import { generateNextCompletionOccurrence } from './series'
import {
  diffDocumentIds,
  syncDocumentTaskLinks,
  syncDocumentsFromTasks,
} from './documentSync'
import type {
  CreateTaskInput as BaseCreateTaskInput,
  UpdateTaskInput as BaseUpdateTaskInput,
  Task,
  TaskStatus,
  TaskPriority,
  TaskSource,
  ActivityEventType,
  AttachedDocMetadata,
  BlockedReason,
  ProgressMode,
} from '@/types/tasks'

const TASKS = 'tasks'
const TASK_COMMENTS = 'taskComments'
const TASK_ACTIVITIES = 'taskActivities'
const STAFF_COLLECTION = 'staff'

export interface CreateTaskInput extends BaseCreateTaskInput {
  status?: TaskStatus
  estimatedMinutes?: number | null
  templateId?: string | null
  dependsOnTaskIds?: string[]
  relatedTaskIds?: string[]
  blockedReason?: BlockedReason | null
  blockedByTaskIds?: string[]
  blockedNote?: string | null
  previousStatus?: TaskStatus | null
  assigneeDepartmentId?: string | null
  progressMode?: ProgressMode
  progress?: number
}

export interface UpdateTaskInput extends BaseUpdateTaskInput {
  assigneeDepartmentId?: string | null
  progressMode?: ProgressMode
  dependsOnTaskIds?: string[]
  relatedTaskIds?: string[]
  estimatedMinutes?: number | null
  templateId?: string | null
}

export interface StatusChangeActor {
  id: string
  name?: string
  role?: 'admin' | 'staff' | 'guest' | string
  departmentIds?: string[]
  matrixPerms?: Partial<Record<string, boolean>>
}

export interface ChangeTaskStatusOptions {
  blockedNote?: string
  blockedReason?: BlockedReason
  blockedByTaskIds?: string[]
  matrixPerms?: Partial<Record<string, boolean>>
  autoStartFromPending?: boolean
  skipPermissionCheck?: boolean
  subtasks?: Pick<Task, 'id' | 'status' | 'deletedAt' | 'isClosed'>[]
}

export interface ParentTaskInheritance {
  assigneeId?: string | null
  assigneeName?: string | null
  assigneeDepartmentId?: string | null
  departmentId?: string | null
  dueDate?: Timestamp | null
}

function normalizeActorContext(actor: StatusChangeActor | string, actorName?: string): {
  userCtx: StaffContext
  actorId: string
  actorName: string
  matrixPerms?: Partial<Record<string, boolean>>
} {
  if (typeof actor === 'string') {
    return {
      userCtx: { id: actor, role: 'staff', departmentIds: [] },
      actorId: actor,
      actorName: actorName || 'Thành viên',
    }
  }
  const rawRole = actor.role || 'nhan_vien'
  const normalizedRole = normalizeTaskActorRole(rawRole)
  return {
    userCtx: {
      id: actor.id,
      role: normalizedRole,
      departmentIds: actor.departmentIds ?? [],
    },
    actorId: actor.id,
    actorName: actor.name || actorName || 'Thành viên',
    matrixPerms: actor.matrixPerms,
  }
}

function toTaskContext(task: Pick<Task, 'createdBy' | 'assigneeId' | 'collaboratorIds' | 'followerIds' | 'departmentId' | 'cooperatingDepartmentIds'>): TaskContext {
  return {
    createdBy: task.createdBy,
    assigneeId: task.assigneeId ?? null,
    collaboratorIds: task.collaboratorIds ?? [],
    followerIds: task.followerIds ?? [],
    departmentId: task.departmentId ?? null,
    cooperatingDepartmentIds: task.cooperatingDepartmentIds ?? [],
  }
}

/**
 * Pure helper to build the payload and notification recipients for `createTask`.
 * When `dependsOnTaskIds` is present, blocked state / `blockedByTaskIds` is derived
 * EXCLUSIVELY from server-verified `uncompletedDepIds` (`checkDependenciesCompleted`),
 * ignoring client-submitted `blockedReason`/`blockedByTaskIds`.
 */
export function buildCreateTaskPayload(
  input: CreateTaskInput,
  actorId: string,
  uncompletedDepIds: string[] = [],
  parentTask?: ParentTaskInheritance | null
): {
  taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
  notificationRecipients: {
    assigneeRecipient: string | null
    collaboratorRecipients: string[]
    allRecipients: string[]
  }
} {
  const isSubtask = Boolean(input.parentTaskId)

  const assigneeId =
    input.assigneeId !== undefined
      ? input.assigneeId || null
      : isSubtask && parentTask?.assigneeId !== undefined
      ? parentTask.assigneeId ?? null
      : null

  const assigneeName =
    input.assigneeName !== undefined
      ? input.assigneeName ?? null
      : isSubtask && assigneeId && assigneeId === parentTask?.assigneeId
      ? parentTask?.assigneeName ?? null
      : null

  const assigneeDepartmentId =
    input.assigneeDepartmentId !== undefined
      ? input.assigneeDepartmentId ?? null
      : isSubtask && assigneeId && assigneeId === parentTask?.assigneeId
      ? parentTask?.assigneeDepartmentId ?? null
      : null

  const departmentId =
    input.departmentId !== undefined
      ? input.departmentId || null
      : isSubtask && parentTask?.departmentId !== undefined
      ? parentTask.departmentId ?? null
      : null

  const dueDate =
    input.dueDate !== undefined
      ? input.dueDate ?? null
      : isSubtask && parentTask?.dueDate !== undefined
      ? parentTask.dueDate ?? null
      : null

  const dependsOnTaskIds = Array.from(new Set((input.dependsOnTaskIds ?? []).filter(Boolean)))
  const effectiveUncompletedDeps = dependsOnTaskIds.length > 0 ? uncompletedDepIds : []

  let status: TaskStatus = input.status ?? 'pending'
  let blockedReason: BlockedReason | null = null
  let blockedByTaskIds: string[] = []
  let blockedNote: string | null = null
  let previousStatus: TaskStatus | null = null

  if (dependsOnTaskIds.length > 0) {
    // Dependency-driven block state is strictly determined by server-checked `uncompletedDepIds`
    const requestedInitialStatus: TaskStatus =
      input.status && input.status !== 'blocked' ? input.status : 'pending'
    if (effectiveUncompletedDeps.length > 0) {
      status = 'blocked'
      blockedReason = 'dependency'
      blockedByTaskIds = [...effectiveUncompletedDeps]
      blockedNote = input.blockedNote ?? null
      previousStatus = input.previousStatus ?? requestedInitialStatus
    } else {
      status = requestedInitialStatus
      blockedReason = null
      blockedByTaskIds = []
      blockedNote = null
      previousStatus = null
    }
  } else if (status === 'blocked') {
    blockedReason = input.blockedReason === 'dependency' ? 'manual' : (input.blockedReason ?? 'manual')
    blockedByTaskIds = []
    blockedNote = input.blockedNote ?? null
    previousStatus = input.previousStatus ?? 'pending'
  }

  const templateId = input.templateId ?? null
  const source: TaskSource = templateId ? 'template' : (input.source ?? 'manual')
  const isClosed = computeIsClosed(status)
  const progressMode: ProgressMode = input.progressMode ?? 'manual'
  const progress = status === 'completed' ? 100 : (input.progress ?? 0)
  const collaboratorIds = Array.from(new Set((input.collaboratorIds ?? []).filter(Boolean)))

  const assigneeRecipient = assigneeId && assigneeId !== actorId ? assigneeId : null
  const collaboratorRecipients = collaboratorIds.filter(
    id => id !== actorId && id !== assigneeId
  )
  const allRecipients = [
    ...(assigneeRecipient ? [assigneeRecipient] : []),
    ...collaboratorRecipients,
  ]

  const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
    taskCode: null,
    title: input.title,
    description: input.description ?? null,
    type: 'single',
    status,
    priority: input.priority ?? 'normal',
    progress,
    progressMode,
    isClosed,
    startDate: input.startDate ?? null,
    dueDate,
    completedAt: null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    occurrenceDate: null,
    visibleFrom: null,
    createdBy: actorId,
    assigneeId,
    assigneeName,
    collaboratorIds,
    followerIds: input.followerIds ?? [],
    departmentId,
    cooperatingDepartmentIds: input.cooperatingDepartmentIds ?? [],
    assigneeDepartmentId,
    blockedReason,
    blockedByTaskIds,
    blockedNote,
    previousStatus,
    dossierIds: input.dossierIds ?? [],
    documentIds: input.documentIds ?? [],
    parentTaskId: input.parentTaskId ?? null,
    sortOrder: input.sortOrder ?? 0,
    dependsOnTaskIds,
    relatedTaskIds: input.relatedTaskIds ?? [],
    seriesId: null,
    occurrenceKey: null,
    templateId,
    tagIds: input.tagIds ?? [],
    attachments: [],
    source,
    deletedAt: null,
    migratedFromChecklistId: null,
  }

  return {
    taskData,
    notificationRecipients: {
      assigneeRecipient,
      collaboratorRecipients,
      allRecipients,
    },
  }
}

export interface PlannedStatusChange {
  valid: boolean
  error?: string
  updates?: {
    status: TaskStatus
    isClosed: boolean
    progress?: number
    blockedReason?: BlockedReason | null
    blockedByTaskIds?: string[]
    blockedNote?: string | null
    previousStatus?: TaskStatus | null
  }
  setCompletedAt?: boolean
  clearCompletedAt?: boolean
  eventType?: ActivityEventType
  metadata?: Record<string, any>
}

/**
 * Pure decision function for changing task status.
 */
export function planStatusChange(
  task: Pick<
    Task,
    | 'id'
    | 'status'
    | 'progress'
    | 'progressMode'
    | 'parentTaskId'
    | 'previousStatus'
    | 'createdBy'
    | 'assigneeId'
    | 'collaboratorIds'
    | 'followerIds'
    | 'departmentId'
    | 'cooperatingDepartmentIds'
  >,
  toStatus: TaskStatus,
  actor: StatusChangeActor,
  opts?: ChangeTaskStatusOptions
): PlannedStatusChange {
  const { userCtx, matrixPerms } = normalizeActorContext(actor)
  const effectivePerms = opts?.matrixPerms ?? matrixPerms

  if (!opts?.skipPermissionCheck) {
    if (!canChangeStatus(userCtx, toTaskContext(task), effectivePerms)) {
      return {
        valid: false,
        error: 'Bạn không có quyền thay đổi trạng thái công việc này',
      }
    }
  }

  const activeSubtasks = (opts?.subtasks ?? []).filter(st => !st.deletedAt)
  const hasIncompleteSubtasks = hasIncompleteSubtasksFromList(activeSubtasks)

  if (toStatus === 'completed' && hasIncompleteSubtasks) {
    return {
      valid: false,
      error: 'Không thể hoàn thành khi còn việc con (subtask) chưa xong',
    }
  }

  const fromStatus = task.status
  const allowDirectFromPending =
    fromStatus === 'pending' &&
    toStatus === 'completed' &&
    (Boolean(opts?.autoStartFromPending) || Boolean(task.parentTaskId))

  if (!allowDirectFromPending) {
    const validation = validateStatusChange(fromStatus, toStatus, hasIncompleteSubtasks)
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error || 'Chuyển trạng thái không hợp lệ',
      }
    }
  }

  const updates: NonNullable<PlannedStatusChange['updates']> = {
    status: toStatus,
    isClosed: computeIsClosed(toStatus),
  }

  let setCompletedAt = false
  let clearCompletedAt = false

  if (toStatus === 'completed') {
    setCompletedAt = true
    updates.progress = 100
    updates.isClosed = true
    updates.blockedReason = null
    updates.blockedByTaskIds = []
    updates.blockedNote = null
    updates.previousStatus = null
  } else if (fromStatus === 'completed' || fromStatus === 'cancelled') {
    // Reopening from completed or cancelled
    clearCompletedAt = true
    updates.isClosed = false
    if (task.progressMode === 'subtask') {
      updates.progress = computeParentSubtaskProgress(activeSubtasks)
    } else {
      updates.progress = typeof task.progress === 'number' && task.progress < 100 ? task.progress : 0
    }
  }

  if (toStatus === 'blocked') {
    updates.previousStatus = fromStatus
    updates.blockedReason = opts?.blockedReason ?? 'manual'
    updates.blockedByTaskIds = opts?.blockedByTaskIds ?? []
    updates.blockedNote = opts?.blockedNote ?? null
  } else if (fromStatus === 'blocked') {
    // Leaving blocked state: clear blocked fields
    updates.blockedReason = null
    updates.blockedByTaskIds = []
    updates.blockedNote = null
    updates.previousStatus = null
  }

  let eventType: ActivityEventType = 'STATUS_CHANGED'
  if (toStatus === 'completed') {
    eventType = 'COMPLETED'
  } else if (fromStatus === 'completed' || fromStatus === 'cancelled') {
    eventType = 'REOPENED'
  } else if (toStatus === 'blocked') {
    eventType = 'BLOCKED'
  } else if (fromStatus === 'blocked') {
    eventType = 'UNBLOCKED'
  }

  const metadata: Record<string, any> = {
    fromStatus,
    newStatus: toStatus,
  }
  if (opts?.blockedNote) {
    metadata.blockedNote = opts.blockedNote
  }

  return {
    valid: true,
    updates,
    setCompletedAt,
    clearCompletedAt,
    eventType,
    metadata,
  }
}

export interface BulkTaskUpdates {
  assigneeId?: string | null
  assigneeName?: string | null
  assigneeDepartmentId?: string | null
  departmentId?: string | null
  priority?: TaskPriority
  status?: TaskStatus
  dueDate?: any // Timestamp or Date or null
  addDossierId?: string
}

export interface BulkUpdateSkippedItem {
  id: string
  reason: string
}

export interface BulkUpdateResult {
  updated: number
  skipped: BulkUpdateSkippedItem[]
}

export interface PlannedBulkTaskItem {
  taskId: string
  task: Task
  fields: Record<string, any>
  setCompletedAt?: boolean
  clearCompletedAt?: boolean
  activities: { eventType: ActivityEventType; metadata: Record<string, any> }[]
  notifyAssigneeId?: string | null
  statusChanged: boolean
  becameCompleted: boolean
}

/**
 * Pure planner for `bulkUpdateTasks`.
 * Evaluates each task, skips invalid status transitions or unauthorized updates,
 * and ensures `STATUS_CHANGED` is only logged when status actually changes.
 */
export function planBulkTaskUpdates(
  taskIds: string[],
  tasksById: Record<string, Task | undefined>,
  updates: BulkTaskUpdates,
  actor: StatusChangeActor,
  opts?: {
    subtasksByParentId?: Record<string, Pick<Task, 'id' | 'status' | 'deletedAt' | 'isClosed'>[]>
    matrixPerms?: Partial<Record<string, boolean>>
  }
): {
  planned: PlannedBulkTaskItem[]
  skipped: BulkUpdateSkippedItem[]
} {
  const planned: PlannedBulkTaskItem[] = []
  const skipped: BulkUpdateSkippedItem[] = []
  const { userCtx, actorId, matrixPerms } = normalizeActorContext(actor)
  const effectivePerms = opts?.matrixPerms ?? matrixPerms

  for (const taskId of taskIds) {
    const task = tasksById[taskId]
    if (!task || task.deletedAt) {
      skipped.push({ id: taskId, reason: 'Không tìm thấy công việc' })
      continue
    }

    const fields: Record<string, any> = {}
    const activities: { eventType: ActivityEventType; metadata: Record<string, any> }[] = []
    let setCompletedAt = false
    let clearCompletedAt = false
    let notifyAssigneeId: string | null = null
    let statusChanged = false
    let becameCompleted = false

    // 1. Status update validation via planStatusChange
    if (updates.status !== undefined) {
      const subtasks = opts?.subtasksByParentId?.[taskId] ?? []
      const statusPlan = planStatusChange(task, updates.status, actor, {
        subtasks,
        matrixPerms: effectivePerms,
      })
      if (!statusPlan.valid || !statusPlan.updates) {
        skipped.push({
          id: taskId,
          reason: statusPlan.error || 'Chuyển trạng thái không hợp lệ',
        })
        continue
      }

      Object.assign(fields, statusPlan.updates)
      setCompletedAt = Boolean(statusPlan.setCompletedAt)
      clearCompletedAt = Boolean(statusPlan.clearCompletedAt)
      statusChanged = task.status !== updates.status
      becameCompleted = statusChanged && updates.status === 'completed'

      if (statusChanged && statusPlan.eventType) {
        activities.push({
          eventType: statusPlan.eventType,
          metadata: { bulk: true, ...(statusPlan.metadata ?? {}) },
        })
      }
    }

    // 2. Assignee update validation via canAssignTask
    if (updates.assigneeId !== undefined) {
      if (!canAssignTask(userCtx, toTaskContext(task), effectivePerms)) {
        skipped.push({
          id: taskId,
          reason: 'Không có quyền giao việc',
        })
        continue
      }

      fields.assigneeId = updates.assigneeId
      fields.assigneeName = updates.assigneeName ?? null
      if (updates.assigneeDepartmentId !== undefined) {
        fields.assigneeDepartmentId = updates.assigneeDepartmentId ?? null
      }

      if (updates.assigneeId !== task.assigneeId) {
        activities.push({
          eventType: 'REASSIGNED',
          metadata: {
            bulk: true,
            field: 'assigneeId',
            from: task.assigneeId ?? null,
            value: updates.assigneeId ?? null,
          },
        })
        if (updates.assigneeId && updates.assigneeId !== actorId) {
          notifyAssigneeId = updates.assigneeId
        }
      }
    }

    if (updates.departmentId !== undefined) {
      fields.departmentId = updates.departmentId
    }

    if (updates.priority !== undefined) {
      fields.priority = updates.priority
      if (updates.priority !== task.priority) {
        activities.push({
          eventType: 'PRIORITY_CHANGED',
          metadata: { bulk: true, field: 'priority', value: updates.priority },
        })
      }
    }

    if (updates.dueDate !== undefined) {
      fields.dueDate = updates.dueDate
      activities.push({
        eventType: 'DEADLINE_CHANGED',
        metadata: { bulk: true, field: 'dueDate', value: updates.dueDate ?? null },
      })
    }

    if (updates.addDossierId) {
      fields.addDossierId = updates.addDossierId
    }

    planned.push({
      taskId,
      task,
      fields,
      setCompletedAt,
      clearCompletedAt,
      activities,
      notifyAssigneeId,
      statusChanged,
      becameCompleted,
    })
  }

  return { planned, skipped }
}

export const MAX_BATCH_OPS = 450
export const MAX_DEPENDENCY_BFS_DEPTH = 50

/**
 * Count actual Firestore batch operations required for a single planned bulk item:
 * 1 (task update) + activities.length + (notifyAssigneeId ? 1 : 0).
 */
export function countPlannedBulkItemOps(
  item: Pick<PlannedBulkTaskItem, 'activities' | 'notifyAssigneeId'>
): number {
  return 1 + item.activities.length + (item.notifyAssigneeId ? 1 : 0)
}

/**
 * Split planned bulk items into batches where each batch has at most `maxOps` (default 450)
 * total write operations, staying safely below Firestore's 500-op batch limit.
 */
export function chunkPlannedBulkItemsByOps<
  T extends Pick<PlannedBulkTaskItem, 'activities' | 'notifyAssigneeId'>
>(items: T[], maxOps: number = MAX_BATCH_OPS): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []
  let currentChunk: T[] = []
  let currentOps = 0

  for (const item of items) {
    const itemOps = countPlannedBulkItemOps(item)
    if (currentChunk.length > 0 && currentOps + itemOps > maxOps) {
      chunks.push(currentChunk)
      currentChunk = [item]
      currentOps = itemOps
    } else {
      currentChunk.push(item)
      currentOps += itemOps
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

/**
 * Pure helper to build the unblock restoration fields when leaving dependency-blocked state.
 */
export function buildUnblockRestoreFields(
  existingTask: Pick<Task, 'previousStatus'>
): {
  status: TaskStatus
  isClosed: boolean
  blockedReason: null
  blockedByTaskIds: string[]
  blockedNote: null
  previousStatus: null
} {
  const restored: TaskStatus =
    existingTask.previousStatus &&
    existingTask.previousStatus !== 'blocked' &&
    !computeIsClosed(existingTask.previousStatus)
      ? existingTask.previousStatus
      : 'pending'
  return {
    status: restored,
    isClosed: computeIsClosed(restored),
    blockedReason: null,
    blockedByTaskIds: [],
    blockedNote: null,
    previousStatus: null,
  }
}

/**
 * Pure helper to compute status/blocked field updates when `dependsOnTaskIds` changes on `updateTask`.
 * - Only auto-blocks when the task is currently open ('pending' | 'in_progress' | 'blocked' and not closed).
 * - Closed tasks ('completed' | 'cancelled') keep their closed status even if incomplete dependencies are added.
 * - Restores from dependency-blocked state via `buildUnblockRestoreFields` when no dependencies remain incomplete.
 */
export function planDependencyStatusUpdate(
  existingTask: Pick<Task, 'status' | 'isClosed' | 'blockedReason' | 'previousStatus'> | null,
  pendingDepIds: string[]
): Record<string, any> {
  if (!existingTask) return {}

  if (pendingDepIds.length > 0) {
    const isTaskOpen =
      !existingTask.isClosed &&
      (existingTask.status === 'pending' ||
        existingTask.status === 'in_progress' ||
        existingTask.status === 'blocked')

    if (!isTaskOpen) {
      return {}
    }

    const updates: Record<string, any> = {
      status: 'blocked',
      isClosed: false,
      blockedReason: 'dependency',
      blockedByTaskIds: [...pendingDepIds],
    }
    if (existingTask.status !== 'blocked') {
      updates.previousStatus = existingTask.status
    }
    return updates
  }

  if (existingTask.status === 'blocked' && existingTask.blockedReason === 'dependency') {
    return buildUnblockRestoreFields(existingTask)
  }

  return {}
}

/**
 * Build dependency subgraph via BFS along `dependsOnTaskIds` using `getTasksByIds`
 * (bounded to `maxDepth = 50`), avoiding reading the entire `tasks` collection.
 */
async function buildDependencyGraphBFS(
  seedTaskIds: string[],
  maxDepth: number = MAX_DEPENDENCY_BFS_DEPTH
): Promise<Record<string, string[]>> {
  const graph: Record<string, string[]> = {}
  const visited = new Set<string>()
  let frontier = Array.from(new Set(seedTaskIds.filter(Boolean)))
  let depth = 0

  try {
    while (frontier.length > 0 && depth < maxDepth) {
      const toFetch = frontier.filter(id => !visited.has(id))
      if (toFetch.length === 0) break

      for (const id of toFetch) {
        visited.add(id)
      }

      const fetchedTasks = await getTasksByIds(toFetch)
      const nextFrontier = new Set<string>()

      for (const t of fetchedTasks) {
        if (t.deletedAt) continue
        const deps = Array.isArray(t.dependsOnTaskIds)
          ? t.dependsOnTaskIds.filter(Boolean)
          : []
        graph[t.id] = deps
        for (const depId of deps) {
          if (!visited.has(depId)) {
            nextFrontier.add(depId)
          }
        }
      }

      frontier = Array.from(nextFrontier)
      depth += 1
    }
  } catch (err) {
    console.warn('[mutations] Could not traverse dependency graph via BFS:', err)
  }

  return graph
}

/**
 * Recalculate `progress` for parent tasks that use `progressMode === 'subtask'`.
 * Cancelled subtasks are excluded from the denominator per `computeParentSubtaskProgress`.
 */
export async function recalculateParentSubtaskProgress(
  parentTaskIds: string[]
): Promise<void> {
  const uniqueParentIds = Array.from(new Set(parentTaskIds.filter(Boolean)))
  if (uniqueParentIds.length === 0) return

  for (const parentId of uniqueParentIds) {
    try {
      const parentRef = doc(db(), TASKS, parentId)
      const parentSnap = await getDoc(parentRef)
      if (!parentSnap.exists()) continue

      const parentData = parentSnap.data()
      if (parentData.deletedAt || parentData.progressMode !== 'subtask') continue

      const subSnap = await getDocs(
        query(collection(db(), TASKS), where('parentTaskId', '==', parentId))
      )
      const subtasks = subSnap.docs.map(d => {
        const data = d.data()
        return {
          status: data.status as TaskStatus,
          isClosed: Boolean(data.isClosed),
          deletedAt: data.deletedAt ?? null,
        }
      })

      const nextProgress =
        parentData.status === 'completed' ? 100 : computeParentSubtaskProgress(subtasks)

      if (nextProgress !== parentData.progress) {
        await updateDoc(parentRef, {
          progress: nextProgress,
          updatedAt: serverTimestamp(),
        })
      }
    } catch (err) {
      console.warn(`[mutations] Failed to recalculate subtask progress for parent ${parentId}:`, err)
    }
  }
}

/**
 * Resolve staff member info (shortName/fullName and primaryDepartmentId) by staffId.
 */
async function resolveStaffInfo(staffId: string): Promise<{
  name: string | null
  primaryDepartmentId: string | null
} | null> {
  if (!staffId) return null
  try {
    const directSnap = await getDoc(doc(db(), STAFF_COLLECTION, staffId))
    if (directSnap.exists()) {
      const data = directSnap.data()
      return {
        name: data.shortName || data.fullName || null,
        primaryDepartmentId: data.primaryDepartmentId ?? data.departmentIds?.[0] ?? null,
      }
    }
    const q = query(collection(db(), STAFF_COLLECTION), where('id', '==', staffId))
    const qSnap = await getDocs(q)
    if (!qSnap.empty) {
      const data = qSnap.docs[0].data()
      return {
        name: data.shortName || data.fullName || null,
        primaryDepartmentId: data.primaryDepartmentId ?? data.departmentIds?.[0] ?? null,
      }
    }
  } catch (err) {
    console.warn(`[mutations] Failed to resolve staff info for ${staffId}:`, err)
  }
  return null
}

// ===== Firestore Mutations =====

export async function createTask(
  input: CreateTaskInput,
  actorId: string,
  actorName: string
): Promise<string> {
  let parentTaskData: ParentTaskInheritance | null = null
  if (input.parentTaskId) {
    try {
      const parentSnap = await getDoc(doc(db(), TASKS, input.parentTaskId))
      if (parentSnap.exists()) {
        const pd = parentSnap.data()
        parentTaskData = {
          assigneeId: pd.assigneeId ?? null,
          assigneeName: pd.assigneeName ?? null,
          assigneeDepartmentId: pd.assigneeDepartmentId ?? null,
          departmentId: pd.departmentId ?? null,
          dueDate: pd.dueDate ?? null,
        }
      }
    } catch (err) {
      console.warn('[createTask] Failed to read parent task for inheritance:', err)
    }
  }

  // Check dependencies completion if dependsOnTaskIds provided
  let uncompletedDepIds: string[] = []
  if (input.dependsOnTaskIds && input.dependsOnTaskIds.length > 0) {
    const depCheck = await checkDependenciesCompleted(input.dependsOnTaskIds)
    if (!depCheck.allCompleted) {
      uncompletedDepIds = depCheck.pendingTaskIds
    }
  }

  // Resolve assigneeDepartmentId / assigneeName from staff if assigneeId is set but department is missing
  let enrichedInput: CreateTaskInput = { ...input }
  const effectiveAssigneeId =
    input.assigneeId !== undefined ? input.assigneeId : parentTaskData?.assigneeId ?? undefined
  if (
    effectiveAssigneeId &&
    (enrichedInput.assigneeDepartmentId === undefined || enrichedInput.assigneeName === undefined)
  ) {
    const staffInfo = await resolveStaffInfo(effectiveAssigneeId)
    if (staffInfo) {
      if (enrichedInput.assigneeDepartmentId === undefined) {
        enrichedInput.assigneeDepartmentId = staffInfo.primaryDepartmentId
      }
      if (enrichedInput.assigneeName === undefined) {
        enrichedInput.assigneeName = staffInfo.name
      }
    }
  }

  const { taskData, notificationRecipients } = buildCreateTaskPayload(
    enrichedInput,
    actorId,
    uncompletedDepIds,
    parentTaskData
  )

  const batch = writeBatch(db())
  const taskRef = doc(collection(db(), TASKS))
  const now = serverTimestamp()

  batch.set(taskRef, {
    ...taskData,
    completedAt: taskData.status === 'completed' ? now : null,
    createdAt: now,
    updatedAt: now,
  })

  // If this is a subtask, ensure parent task uses progressMode: 'subtask'
  if (taskData.parentTaskId) {
    batch.update(doc(db(), TASKS, taskData.parentTaskId), {
      progressMode: 'subtask',
      updatedAt: now,
    })
  }

  // Activity log
  const activityRef = doc(collection(db(), TASK_ACTIVITIES))
  batch.set(activityRef, {
    taskId: taskRef.id,
    actorId,
    actorName,
    eventType: 'CREATED',
    metadata: {
      title: taskData.title,
      status: taskData.status,
      source: taskData.source,
    },
    createdAt: now,
  })

  // Notification for assignee
  if (notificationRecipients.assigneeRecipient) {
    queueNotification(batch, {
      recipientId: notificationRecipients.assigneeRecipient,
      category: 'TASK_ASSIGNED',
      entityType: 'task',
      entityId: taskRef.id,
      title: 'Công việc mới được giao',
      body: `${actorName} đã giao cho bạn: "${taskData.title}"`,
      actorId,
      actorName,
    })
  }

  // Notifications for collaborators (excluding creator & assignee)
  for (const collabId of notificationRecipients.collaboratorRecipients) {
    queueNotification(batch, {
      recipientId: collabId,
      category: 'TASK_ASSIGNED',
      entityType: 'task',
      entityId: taskRef.id,
      title: 'Công việc mới phối hợp',
      body: `${actorName} đã thêm bạn phối hợp: "${taskData.title}"`,
      actorId,
      actorName,
    })
  }

  await batch.commit()

  if (taskData.parentTaskId) {
    await recalculateParentSubtaskProgress([taskData.parentTaskId])
  }

  // Sync two-way document links and derive document status for root tasks
  if (taskData.documentIds.length > 0 && !taskData.parentTaskId) {
    await syncDocumentTaskLinks(taskRef.id, taskData.documentIds, [])
    await syncDocumentsFromTasks(taskData.documentIds)
  }

  return taskRef.id
}

/**
 * Single authoritative mutation for all task status transitions.
 */
export async function changeTaskStatus(
  taskId: string,
  toStatus: TaskStatus,
  actor: StatusChangeActor,
  opts?: ChangeTaskStatusOptions
): Promise<void> {
  const { actorId, actorName } = normalizeActorContext(actor)
  const taskRef = doc(db(), TASKS, taskId)
  const taskSnap = await getDoc(taskRef)
  if (!taskSnap.exists() || taskSnap.data().deletedAt) {
    throw new Error('Không tìm thấy công việc')
  }

  const task = { id: taskSnap.id, ...taskSnap.data() } as Task

  // Fetch subtasks if completing or reopening in subtask mode
  let subtasks = opts?.subtasks
  if (!subtasks && !task.parentTaskId) {
    const subSnap = await getDocs(
      query(collection(db(), TASKS), where('parentTaskId', '==', taskId))
    )
    subtasks = subSnap.docs.map(d => ({
      id: d.id,
      ...(d.data() as any),
    }))
  }

  const plan = planStatusChange(task, toStatus, actor, {
    ...opts,
    subtasks,
  })

  if (!plan.valid || !plan.updates) {
    throw new Error(plan.error || 'Chuyển trạng thái không hợp lệ')
  }

  const batch = writeBatch(db())
  const now = serverTimestamp()

  const updateData: Record<string, any> = {
    ...plan.updates,
    updatedAt: now,
  }
  if (plan.setCompletedAt) {
    updateData.completedAt = now
  } else if (plan.clearCompletedAt) {
    updateData.completedAt = null
  }

  batch.update(taskRef, updateData)

  // Activity log
  const activityRef = doc(collection(db(), TASK_ACTIVITIES))
  batch.set(activityRef, {
    taskId,
    actorId,
    actorName,
    eventType: plan.eventType ?? 'STATUS_CHANGED',
    metadata: plan.metadata ?? { newStatus: toStatus },
    createdAt: now,
  })

  await batch.commit()

  // Post-commit side effects when completed
  if (toStatus === 'completed') {
    await resolveBlockedDependencies(taskId, actorId, actorName)

    if (task.seriesId) {
      try {
        await generateNextCompletionOccurrence({
          ...task,
          status: 'completed',
          isClosed: true,
          completedAt: Timestamp.now(),
        })
      } catch (genErr) {
        console.warn('[changeTaskStatus] Next occurrence trigger warning:', genErr)
      }
    }
  }

  // If this task is a subtask, recalculate parent progress (when parent is in subtask mode)
  if (task.parentTaskId) {
    await recalculateParentSubtaskProgress([task.parentTaskId])
  }

  // Sync linked documents
  if (task.documentIds?.length && !task.parentTaskId) {
    await syncDocumentsFromTasks(task.documentIds)
  }
}

/**
 * @deprecated Thin wrapper delegating to `changeTaskStatus` with required actor (least-privileged role default).
 */
export const updateTaskStatus = async (
  taskId: string,
  newStatus: TaskStatus,
  actor: StatusChangeActor | string,
  actorName?: string,
  blockedNote?: string
): Promise<void> => {
  const requiredActor: StatusChangeActor =
    typeof actor === 'string'
      ? { id: actor, name: actorName, role: 'nhan_vien', departmentIds: [] }
      : actor
  await changeTaskStatus(
    taskId,
    newStatus,
    requiredActor,
    { blockedNote, autoStartFromPending: true }
  )
}

export async function updateTask(
  taskId: string,
  fields: UpdateTaskInput,
  actorId: string,
  actorName: string
): Promise<void> {
  const taskRef = doc(db(), TASKS, taskId)
  const existingSnap = await getDoc(taskRef)
  const existingTask = existingSnap.exists()
    ? ({ id: existingSnap.id, ...existingSnap.data() } as Task)
    : null

  const updateData: Record<string, any> = {
    ...fields,
    updatedAt: serverTimestamp(),
  }

  // 1. Validate dependencies for cycles via BFS & auto-block/unblock open tasks
  if (fields.dependsOnTaskIds !== undefined) {
    const nextDeps = Array.from(new Set((fields.dependsOnTaskIds ?? []).filter(Boolean)))
    updateData.dependsOnTaskIds = nextDeps

    let pendingDepIds: string[] = []
    if (nextDeps.length > 0) {
      const graph = await buildDependencyGraphBFS(nextDeps, MAX_DEPENDENCY_BFS_DEPTH)
      const cycleCheck = validateDependencyList(taskId, nextDeps, graph)
      if (!cycleCheck.valid) {
        throw new Error(cycleCheck.error || 'Phát hiện phụ thuộc vòng giữa các công việc')
      }

      const depCheck = await checkDependenciesCompleted(nextDeps)
      if (!depCheck.allCompleted) {
        pendingDepIds = depCheck.pendingTaskIds
      }
    }

    Object.assign(updateData, planDependencyStatusUpdate(existingTask, pendingDepIds))
  }

  // 2. Handle assignee change: resolve assigneeName & assigneeDepartmentId
  const assigneeChanged =
    fields.assigneeId !== undefined && fields.assigneeId !== existingTask?.assigneeId
  if (fields.assigneeId !== undefined) {
    if (!fields.assigneeId) {
      updateData.assigneeId = null
      updateData.assigneeName = null
      updateData.assigneeDepartmentId = null
    } else {
      if (fields.assigneeName === undefined || fields.assigneeDepartmentId === undefined) {
        const staffInfo = await resolveStaffInfo(fields.assigneeId)
        if (fields.assigneeName === undefined) {
          updateData.assigneeName = staffInfo?.name ?? null
        }
        if (fields.assigneeDepartmentId === undefined) {
          updateData.assigneeDepartmentId = staffInfo?.primaryDepartmentId ?? null
        }
      }
    }
  }

  const batch = writeBatch(db())
  batch.update(taskRef, updateData)

  // 3. Activity logging (DO NOT log STATUS_CHANGED for title/description)
  if (fields.priority !== undefined && fields.priority !== existingTask?.priority) {
    const activityRef = doc(collection(db(), TASK_ACTIVITIES))
    batch.set(activityRef, {
      taskId,
      actorId,
      actorName,
      eventType: 'PRIORITY_CHANGED',
      metadata: { field: 'priority', value: fields.priority ?? null },
      createdAt: serverTimestamp(),
    })
  }

  if (fields.dueDate !== undefined) {
    const activityRef = doc(collection(db(), TASK_ACTIVITIES))
    batch.set(activityRef, {
      taskId,
      actorId,
      actorName,
      eventType: 'DEADLINE_CHANGED',
      metadata: { field: 'dueDate', value: fields.dueDate ?? null },
      createdAt: serverTimestamp(),
    })
  }

  if (assigneeChanged) {
    const activityRef = doc(collection(db(), TASK_ACTIVITIES))
    batch.set(activityRef, {
      taskId,
      actorId,
      actorName,
      eventType: 'REASSIGNED',
      metadata: {
        field: 'assigneeId',
        from: existingTask?.assigneeId ?? null,
        value: updateData.assigneeId ?? null,
        assigneeName: updateData.assigneeName ?? null,
      },
      createdAt: serverTimestamp(),
    })

    // Notify new assignee
    if (updateData.assigneeId && updateData.assigneeId !== actorId) {
      queueNotification(batch, {
        recipientId: updateData.assigneeId,
        category: 'TASK_ASSIGNED',
        entityType: 'task',
        entityId: taskId,
        title: 'Công việc được giao cho bạn',
        body: `${actorName} đã giao cho bạn: "${fields.title ?? existingTask?.title ?? ''}"`,
        actorId,
        actorName,
      })
    }
  }

  if (fields.dependsOnTaskIds !== undefined) {
    const prevDeps = existingTask?.dependsOnTaskIds ?? []
    const addedDeps = (updateData.dependsOnTaskIds as string[]).filter(id => !prevDeps.includes(id))
    if (addedDeps.length > 0) {
      const activityRef = doc(collection(db(), TASK_ACTIVITIES))
      batch.set(activityRef, {
        taskId,
        actorId,
        actorName,
        eventType: 'DEPENDENCY_ADDED',
        metadata: { addedDependsOnTaskIds: addedDeps, dependsOnTaskIds: updateData.dependsOnTaskIds },
        createdAt: serverTimestamp(),
      })
    }
  }

  await batch.commit()

  // 4. Sync documents when documentIds changed
  if (fields.documentIds !== undefined && !existingTask?.parentTaskId) {
    const { added, removed, affected } = diffDocumentIds(
      existingTask?.documentIds,
      fields.documentIds
    )
    if (affected.length > 0) {
      await syncDocumentTaskLinks(taskId, added, removed)
      await syncDocumentsFromTasks(affected)
    }
  }
}

export async function updateSubtaskTitle(
  subtaskId: string,
  newTitle: string
): Promise<void> {
  const ref = doc(db(), TASKS, subtaskId)
  await updateDoc(ref, {
    title: newTitle.trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function addTaskComment(
  taskId: string,
  content: string,
  actorId: string,
  actorName: string,
  mentions: string[] = [],
  attachedDocId?: string | null,
  attachedDocMetadata?: AttachedDocMetadata | null
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
    attachedDocId: attachedDocId || null,
    attachedDocMetadata: attachedDocMetadata || null,
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

export async function deleteTaskComment(commentId: string): Promise<void> {
  const ref = doc(db(), TASK_COMMENTS, commentId)
  await updateDoc(ref, {
    deletedAt: serverTimestamp(),
  })
}

export async function deleteTask(
  taskId: string,
  actorId: string
): Promise<void> {
  const taskRef = doc(db(), TASKS, taskId)
  const snap = await getDoc(taskRef)
  const existingTask = snap.exists() ? ({ id: snap.id, ...snap.data() } as Task) : null

  // Soft delete
  await updateDoc(taskRef, {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  if (existingTask?.parentTaskId) {
    await recalculateParentSubtaskProgress([existingTask.parentTaskId])
  }

  if (existingTask?.documentIds?.length && !existingTask.parentTaskId) {
    await syncDocumentTaskLinks(taskId, [], existingTask.documentIds)
    await syncDocumentsFromTasks(existingTask.documentIds)
  }
}

export async function bulkUpdateTasks(
  taskIds: string[],
  updates: BulkTaskUpdates,
  actorId: string,
  actorName: string,
  actorOpts?: {
    role?: 'admin' | 'staff' | 'guest' | string
    departmentIds?: string[]
    matrixPerms?: Partial<Record<string, boolean>>
  }
): Promise<BulkUpdateResult> {
  if (!taskIds.length) return { updated: 0, skipped: [] }

  // 1. Read tasks and their subtasks if needed
  const tasksById: Record<string, Task | undefined> = {}
  const subtasksByParentId: Record<string, Pick<Task, 'id' | 'status' | 'deletedAt' | 'isClosed'>[]> = {}

  for (const id of taskIds) {
    try {
      const snap = await getDoc(doc(db(), TASKS, id))
      if (snap.exists()) {
        tasksById[id] = { id: snap.id, ...snap.data() } as Task
      }
    } catch (err) {
      console.warn(`[bulkUpdateTasks] Failed to read task ${id}:`, err)
    }
  }

  if (updates.status !== undefined) {
    for (const id of taskIds) {
      const t = tasksById[id]
      if (!t || t.parentTaskId) continue
      if (updates.status === 'completed' || t.progressMode === 'subtask') {
        try {
          const subSnap = await getDocs(
            query(collection(db(), TASKS), where('parentTaskId', '==', id))
          )
          subtasksByParentId[id] = subSnap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
          }))
        } catch (err) {
          console.warn(`[bulkUpdateTasks] Failed to read subtasks for ${id}:`, err)
        }
      }
    }
  }

  // Enrich assigneeDepartmentId if assigneeId is being updated
  const enrichedUpdates: BulkTaskUpdates = { ...updates }
  if (enrichedUpdates.assigneeId && enrichedUpdates.assigneeDepartmentId === undefined) {
    const staffInfo = await resolveStaffInfo(enrichedUpdates.assigneeId)
    if (staffInfo) {
      enrichedUpdates.assigneeDepartmentId = staffInfo.primaryDepartmentId
      if (enrichedUpdates.assigneeName === undefined) {
        enrichedUpdates.assigneeName = staffInfo.name
      }
    }
  } else if (enrichedUpdates.assigneeId === null) {
    enrichedUpdates.assigneeDepartmentId = null
  }

  const actor: StatusChangeActor = {
    id: actorId,
    name: actorName,
    role: actorOpts?.role ?? 'nhan_vien',
    departmentIds: actorOpts?.departmentIds ?? [],
    matrixPerms: actorOpts?.matrixPerms,
  }

  const { planned, skipped } = planBulkTaskUpdates(
    taskIds,
    tasksById,
    enrichedUpdates,
    actor,
    {
      subtasksByParentId,
      matrixPerms: actorOpts?.matrixPerms,
    }
  )

  if (planned.length === 0) {
    return { updated: 0, skipped }
  }

  // Chunk by actual Firestore operation count (cut at 450 ops per batch)
  const chunks = chunkPlannedBulkItemsByOps(planned, MAX_BATCH_OPS)
  for (const chunk of chunks) {
    const batch = writeBatch(db())

    for (const item of chunk) {
      const taskRef = doc(db(), TASKS, item.taskId)
      const data: Record<string, any> = {
        ...item.fields,
        updatedAt: serverTimestamp(),
      }

      if (data.addDossierId) {
        data.dossierIds = arrayUnion(data.addDossierId)
        delete data.addDossierId
      }

      if (item.setCompletedAt) {
        data.completedAt = serverTimestamp()
      } else if (item.clearCompletedAt) {
        data.completedAt = null
      }

      batch.update(taskRef, data)

      for (const act of item.activities) {
        const activityRef = doc(collection(db(), TASK_ACTIVITIES))
        batch.set(activityRef, {
          taskId: item.taskId,
          actorId,
          actorName,
          eventType: act.eventType,
          metadata: act.metadata,
          createdAt: serverTimestamp(),
        })
      }

      if (item.notifyAssigneeId) {
        queueNotification(batch, {
          recipientId: item.notifyAssigneeId,
          category: 'TASK_ASSIGNED',
          entityType: 'task',
          entityId: item.taskId,
          title: 'Công việc được giao cho bạn',
          body: `${actorName} đã giao cho bạn: "${item.task.title}"`,
          actorId,
          actorName,
        })
      }
    }

    await batch.commit()
  }

  // Post-commit side effects: dependency resolution, recurring series next occurrence, parent progress, document sync
  const affectedDocIds: string[] = []
  const affectedParentIds: string[] = []
  for (const item of planned) {
    if (item.becameCompleted) {
      await resolveBlockedDependencies(item.taskId, actorId, actorName)
      if (item.task.seriesId) {
        try {
          await generateNextCompletionOccurrence({
            ...item.task,
            status: 'completed',
            isClosed: true,
            completedAt: Timestamp.now(),
          })
        } catch (err) {
          console.warn(`[bulkUpdateTasks] Next occurrence warning for ${item.taskId}:`, err)
        }
      }
    }
    if (item.statusChanged && item.task.parentTaskId) {
      affectedParentIds.push(item.task.parentTaskId)
    }
    if (item.statusChanged && item.task.documentIds?.length && !item.task.parentTaskId) {
      affectedDocIds.push(...item.task.documentIds)
    }
  }

  if (affectedParentIds.length > 0) {
    await recalculateParentSubtaskProgress(affectedParentIds)
  }

  if (affectedDocIds.length > 0) {
    await syncDocumentsFromTasks(affectedDocIds)
  }

  return { updated: planned.length, skipped }
}

export async function bulkDeleteTasks(
  taskIds: string[],
  actorId: string,
  actorName: string
): Promise<void> {
  if (!taskIds.length) return

  const tasksToDelete: Task[] = []
  for (const id of taskIds) {
    try {
      const snap = await getDoc(doc(db(), TASKS, id))
      if (snap.exists()) {
        tasksToDelete.push({ id: snap.id, ...snap.data() } as Task)
      }
    } catch (err) {
      console.warn(`[bulkDeleteTasks] Failed to read task ${id}:`, err)
    }
  }

  // Each deleted task writes 2 ops (task update + DELETED activity) -> 225 * 2 = 450 ops max
  const CHUNK_SIZE = Math.floor(MAX_BATCH_OPS / 2)
  for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
    const chunk = taskIds.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db())

    for (const taskId of chunk) {
      const taskRef = doc(db(), TASKS, taskId)
      batch.update(taskRef, {
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      const activityRef = doc(collection(db(), TASK_ACTIVITIES))
      batch.set(activityRef, {
        taskId,
        actorId,
        actorName,
        eventType: 'DELETED',
        metadata: { bulk: true },
        createdAt: serverTimestamp(),
      })
    }

    await batch.commit()
  }

  const affectedDocIds: string[] = []
  const affectedParentIds: string[] = []
  for (const t of tasksToDelete) {
    if (t.parentTaskId) {
      affectedParentIds.push(t.parentTaskId)
    }
    if (t.documentIds?.length && !t.parentTaskId) {
      await syncDocumentTaskLinks(t.id, [], t.documentIds)
      affectedDocIds.push(...t.documentIds)
    }
  }
  if (affectedParentIds.length > 0) {
    await recalculateParentSubtaskProgress(affectedParentIds)
  }
  if (affectedDocIds.length > 0) {
    await syncDocumentsFromTasks(affectedDocIds)
  }
}

/**
 * Reorder subtasks and persist sortOrder to Firestore in a batch
 */
export async function reorderSubtasks(
  parentTaskId: string,
  orderedSubtaskIds: string[],
  actorId?: string,
  actorName?: string
): Promise<void> {
  if (!orderedSubtaskIds.length) return
  const batch = writeBatch(db())

  orderedSubtaskIds.forEach((id, index) => {
    const taskRef = doc(db(), TASKS, id)
    batch.update(taskRef, {
      sortOrder: index,
      updatedAt: serverTimestamp(),
    })
  })

  if (actorId && actorName) {
    const activityRef = doc(collection(db(), TASK_ACTIVITIES))
    batch.set(activityRef, {
      taskId: parentTaskId,
      actorId,
      actorName,
      eventType: 'PROGRESS_UPDATED',
      metadata: { subtaskReordered: true, count: orderedSubtaskIds.length },
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
}
