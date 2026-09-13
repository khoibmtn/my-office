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
 *
 * Permission matrix flags:
 *   - task:edit_all  → can edit ANY task (creator, assignee, or others')
 *   - task:edit_own  → can only edit tasks created by self (or assigned to self)
 *
 * Admin: always allowed.
 */
export function canEditTask(
  user: StaffContext,
  task: TaskContext,
  matrixPerms?: Partial<Record<string, boolean>>
): boolean {
  if (user.role === 'admin') return true

  const isOwner = task.createdBy === user.id
  const isAssignee = task.assigneeId === user.id

  // If matrix permissions are provided, use them
  if (matrixPerms) {
    if (matrixPerms['task:edit_all']) {
      // Scope: chỉ trong phạm vi khoa (trừ admin đã return ở trên)
      const inDepartment = task.departmentId != null && user.departmentIds.includes(task.departmentId)
      const inCooperating = task.cooperatingDepartmentIds.some(d => user.departmentIds.includes(d))
      return inDepartment || inCooperating || isOwner || isAssignee
    }
    if (matrixPerms['task:edit_own']) return isOwner || isAssignee
    return false
  }

  // Fallback: creator + assignee can edit
  return isOwner || isAssignee
}

// ===== Delete =====

/**
 * Can this user delete (soft) this task?
 *
 * Permission matrix flags:
 *   - task:delete_all → can delete ANY task
 *   - task:delete_own → can only delete tasks created by self
 *
 * Admin: always allowed.
 */
export function canDeleteTask(
  user: StaffContext,
  task: TaskContext,
  matrixPerms?: Partial<Record<string, boolean>>
): boolean {
  if (user.role === 'admin') return true

  const isOwner = task.createdBy === user.id

  // If matrix permissions are provided, use them
  if (matrixPerms) {
    if (matrixPerms['task:delete_all']) {
      // Scope: chỉ trong phạm vi khoa (trừ admin đã return ở trên)
      const inDepartment = task.departmentId != null && user.departmentIds.includes(task.departmentId)
      const inCooperating = task.cooperatingDepartmentIds.some(d => user.departmentIds.includes(d))
      return inDepartment || inCooperating || isOwner
    }
    if (matrixPerms['task:delete_own']) return isOwner
    return false
  }

  // Fallback: only creator can delete
  return isOwner
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
