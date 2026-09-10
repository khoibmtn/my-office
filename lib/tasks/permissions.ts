/**
 * Task RBAC permission checks.
 * Pure functions — no React/Firestore dependencies.
 *
 * Permission Layers (spec Section 6):
 *   Layer 1: System Role (admin / staff / guest)
 *   Layer 2: Department Role (head / deputy / member)
 *   Layer 3: Task Context (creator / assignee / collaborator / follower)
 */

interface StaffContext {
  id: string
  role: 'admin' | 'staff' | 'guest'
  departmentIds: string[]
}

interface TaskContext {
  createdBy: string
  assigneeId: string | null
  collaboratorIds: string[]
  followerIds: string[]
  departmentId: string | null
  cooperatingDepartmentIds: string[]
}

// ===== View =====

/**
 * Can this user see this task?
 * Visible to: admin, creator, assignee, collaborator, follower,
 * same department, cooperating department.
 * Guest: NEVER.
 */
export function canViewTask(user: StaffContext, task: TaskContext): boolean {
  if (user.role === 'guest') return false
  if (user.role === 'admin') return true

  return (
    task.createdBy === user.id ||
    task.assigneeId === user.id ||
    task.collaboratorIds.includes(user.id) ||
    task.followerIds.includes(user.id) ||
    (task.departmentId != null && user.departmentIds.includes(task.departmentId)) ||
    task.cooperatingDepartmentIds.some(d => user.departmentIds.includes(d))
  )
}

// ===== Edit =====

/**
 * Can this user edit task fields (title, description, priority, deadline)?
 * Allowed: admin, creator, assignee.
 * NOT allowed: collaborator (read + comment only), follower (view only).
 */
export function canEditTask(user: StaffContext, task: TaskContext): boolean {
  if (user.role === 'admin') return true
  return task.createdBy === user.id || task.assigneeId === user.id
}

// ===== Delete =====

/**
 * Can this user delete (soft) this task?
 * Allowed: admin, creator.
 * NOT allowed: assignee, collaborator, follower.
 */
export function canDeleteTask(user: StaffContext, task: TaskContext): boolean {
  if (user.role === 'admin') return true
  return task.createdBy === user.id
}

// ===== Status Change =====

/**
 * Can this user change task status (start, complete, block, cancel)?
 * Allowed: admin, creator, assignee.
 */
export function canChangeStatus(user: StaffContext, task: TaskContext): boolean {
  if (user.role === 'admin') return true
  return task.createdBy === user.id || task.assigneeId === user.id
}

// ===== Assign =====

/**
 * Can this user assign/reassign the task to someone else?
 * Allowed: admin, creator.
 * NOT allowed: assignee (can't reassign themselves), collaborator, follower.
 */
export function canAssignTask(user: StaffContext, task: TaskContext): boolean {
  if (user.role === 'admin') return true
  return task.createdBy === user.id
}

// ===== Comment =====

/**
 * Can this user add comments to this task?
 * Allowed: admin, creator, assignee, collaborator.
 * NOT allowed: follower (view only), guest.
 */
export function canAddComment(user: StaffContext, task: TaskContext): boolean {
  if (user.role === 'admin') return true
  return (
    task.createdBy === user.id ||
    task.assigneeId === user.id ||
    task.collaboratorIds.includes(user.id)
  )
}

// ===== Add Subtask =====

/**
 * Can this user add subtasks?
 * Same as canAddComment: admin, creator, assignee, collaborator.
 */
export function canAddSubtask(user: StaffContext, task: TaskContext): boolean {
  return canAddComment(user, task)
}

// ===== Manage Series =====

/**
 * Can this user manage TaskSeries (create, edit, pause, resume, end)?
 * Allowed: admin, series creator.
 */
export function canManageSeries(user: StaffContext, seriesCreatedBy: string): boolean {
  if (user.role === 'admin') return true
  return seriesCreatedBy === user.id
}
