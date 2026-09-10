/**
 * Progress calculation and derived state computation.
 * Pure functions — no React, no Firestore dependencies.
 * See spec Section 4.2 for derived states.
 */

export type DerivedState = 'OVERDUE' | 'AT_RISK' | 'UPCOMING'

interface SubtaskForProgress {
  isClosed: boolean
}

/**
 * Calculate progress percentage from subtask completion.
 * Returns 0-100, rounded to nearest integer.
 * Returns 0 if no subtasks.
 */
export function calculateSubtaskProgress(subtasks: SubtaskForProgress[]): number {
  if (subtasks.length === 0) return 0
  const completed = subtasks.filter(s => s.isClosed).length
  return Math.round((completed / subtasks.length) * 100)
}

interface DerivedStateInput {
  dueDate: Date | null
  isClosed: boolean
  progress: number
  visibleFrom: Date | null
}

/**
 * Compute derived states for a task.
 * These are NOT stored in DB — computed at render time.
 *
 * - OVERDUE:  dueDate < now AND not closed
 * - AT_RISK:  dueDate within 2 days AND not closed AND progress < 80%
 * - UPCOMING: visibleFrom > now (occurrence not yet visible)
 */
export function computeDerivedStates(input: DerivedStateInput): DerivedState[] {
  const states: DerivedState[] = []
  const now = new Date()

  // UPCOMING: task not yet visible (for recurring occurrences)
  if (input.visibleFrom && input.visibleFrom > now) {
    states.push('UPCOMING')
  }

  // Skip overdue/at-risk checks if task is closed
  if (input.dueDate && !input.isClosed) {
    const msLeft = input.dueDate.getTime() - now.getTime()
    const daysLeft = msLeft / (1000 * 60 * 60 * 24)

    if (daysLeft < 0) {
      states.push('OVERDUE')
    } else if (daysLeft <= 2 && input.progress < 80) {
      states.push('AT_RISK')
    }
  }

  return states
}
