import type { TaskStatus } from '@/types/tasks'
import { VALID_TRANSITIONS, CLOSED_STATUSES, TASK_STATUS_LABELS } from './constants'

/**
 * Check if a status transition is valid per the state machine.
 * See spec Section 4 — Task State Machine.
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return false
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Compute the isClosed flag for a given status.
 * isClosed = true for COMPLETED and CANCELLED.
 * Used for queries: OVERDUE = dueDate < now && isClosed == false
 */
export function computeIsClosed(status: TaskStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

/**
 * A subtask is considered closed/done if `isClosed` is true or its `status` is in `CLOSED_STATUSES`
 * ('completed' | 'cancelled'). Cancelled subtasks do NOT block completing the parent task.
 */
export function isSubtaskClosed(subtask: {
  status: TaskStatus
  isClosed?: boolean
  deletedAt?: unknown
}): boolean {
  return Boolean(subtask.isClosed || CLOSED_STATUSES.includes(subtask.status))
}

/**
 * Returns true if any non-deleted subtask is still open (not closed and status not in CLOSED_STATUSES).
 */
export function hasIncompleteSubtasksFromList(
  subtasks: { status: TaskStatus; isClosed?: boolean; deletedAt?: unknown }[]
): boolean {
  return subtasks
    .filter(s => !s.deletedAt)
    .some(s => !isSubtaskClosed(s))
}

/**
 * Compute parent task progress (0-100) from its subtasks when `progressMode === 'subtask'`.
 * - Soft-deleted subtasks are ignored.
 * - Cancelled subtasks (`status === 'cancelled'`) are excluded from the denominator.
 * - Closed/completed subtasks count toward the numerator.
 */
export function computeParentSubtaskProgress(
  subtasks: { status: TaskStatus; isClosed?: boolean; deletedAt?: unknown }[]
): number {
  const countable = subtasks.filter(s => !s.deletedAt && s.status !== 'cancelled')
  if (countable.length === 0) return 0
  const completedCount = countable.filter(s => isSubtaskClosed(s)).length
  return Math.round((completedCount / countable.length) * 100)
}

/**
 * Validate a status change, including business rules.
 *
 * @param currentStatus - Current task status
 * @param newStatus - Desired new status
 * @param hasIncompleteSubtasks - Whether task has subtasks that aren't completed
 * @returns { valid, error? }
 */
export function validateStatusChange(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  hasIncompleteSubtasks: boolean = false
): { valid: boolean; error?: string } {
  if (newStatus === 'completed' && hasIncompleteSubtasks) {
    return {
      valid: false,
      error: 'Không thể hoàn thành khi còn việc con (subtask) chưa xong',
    }
  }

  if (!isValidTransition(currentStatus, newStatus)) {
    const fromLabel = TASK_STATUS_LABELS[currentStatus] || currentStatus
    const toLabel = TASK_STATUS_LABELS[newStatus] || newStatus
    return {
      valid: false,
      error: `Không thể chuyển trạng thái từ "${fromLabel}" (${currentStatus}) sang "${toLabel}" (${newStatus})`,
    }
  }

  return { valid: true }
}

/**
 * Detect if adding a dependency would create a cycle.
 * Uses DFS: checks if toTask can reach fromTask via existing dependencies.
 *
 * Called BEFORE adding the dependency. If returns true, reject the operation.
 *
 * @param fromTask - Task that would DEPEND ON toTask (fromTask.dependsOnTaskIds.push(toTask))
 * @param toTask - Task being added as dependency
 * @param graph - adjacency list: taskId → dependsOnTaskIds[]
 * @returns true if cycle would be created (REJECT the dependency)
 */
export function detectDependencyCycle(
  fromTask: string,
  toTask: string,
  graph: Record<string, string[]>
): boolean {
  // Self-dependency is always a cycle
  if (fromTask === toTask) return true

  // DFS from toTask: can we reach fromTask?
  // If yes, adding fromTask→toTask creates a cycle.
  const visited = new Set<string>()

  function dfs(current: string): boolean {
    if (current === fromTask) return true
    if (visited.has(current)) return false
    visited.add(current)
    const deps = graph[current] ?? []
    return deps.some(dep => dfs(dep))
  }

  return dfs(toTask)
}

/**
 * Validate a full list of dependency IDs to be set on `fromTask`.
 * Rejects self-dependency or any cycle in `graph`.
 */
export function validateDependencyList(
  fromTask: string,
  dependsOnTaskIds: string[],
  graph: Record<string, string[]>
): { valid: boolean; error?: string; cyclicTaskId?: string } {
  const workingGraph: Record<string, string[]> = {
    ...graph,
    [fromTask]: [],
  }

  for (const depId of dependsOnTaskIds) {
    if (!depId) continue
    if (detectDependencyCycle(fromTask, depId, workingGraph)) {
      return {
        valid: false,
        cyclicTaskId: depId,
        error:
          fromTask === depId
            ? 'Không thể tạo phụ thuộc vòng: công việc không thể phụ thuộc vào chính nó'
            : 'Không thể thêm phụ thuộc: phát hiện phụ thuộc vòng giữa các công việc',
      }
    }
    workingGraph[fromTask] = [...workingGraph[fromTask], depId]
  }

  return { valid: true }
}
