import type { TaskStatus } from '@/types/tasks'
import { VALID_TRANSITIONS, CLOSED_STATUSES } from './constants'

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
  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      valid: false,
      error: `Không thể chuyển từ "${currentStatus}" sang "${newStatus}"`,
    }
  }

  if (newStatus === 'completed' && hasIncompleteSubtasks) {
    return {
      valid: false,
      error: 'Không thể hoàn thành khi còn subtask chưa xong',
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
