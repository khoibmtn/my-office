/**
 * Task RBAC permission checks.
 * Pure functions — no React/Firestore dependencies.
 *
 * Permission Layers (spec Section 6):
 *   Layer 1: System Role (admin / staff / guest)
 *   Layer 2: Department Role (head / deputy / member)
 *   Layer 3: Task Context (creator / assignee / collaborator / follower)
 */

export interface StaffContext {
  id: string
  role: 'admin' | 'staff' | 'guest'
  departmentIds: string[]
}

export interface TaskContext {
  createdBy: string
  assigneeId: string | null
  collaboratorIds: string[]
  followerIds: string[]
  departmentId: string | null
  cooperatingDepartmentIds: string[]
}

export interface TaskActorPayload {
  id: string
  name: string
  role: 'admin' | 'staff' | 'guest' | 'nhan_vien' | string
  departmentIds: string[]
  matrixPerms: Partial<Record<string, boolean>>
}

/**
 * Normalize raw role string into StaffContext role ('admin' | 'staff' | 'guest').
 * Defaults to least-privileged staff ('nhan_vien' -> 'staff'), NEVER 'admin'.
 */
export function normalizeTaskActorRole(
  rawRole?: string | null,
  isAdmin?: boolean
): 'admin' | 'staff' | 'guest' {
  if (isAdmin || rawRole === 'admin') return 'admin'
  if (rawRole === 'guest') return 'guest'
  return 'staff'
}

/**
 * Extract unique departmentIds for a staff member, merging any explicit fallback department IDs.
 */
export function extractActorDepartmentIds(
  currentStaff?: {
    departmentIds?: string[] | null
    primaryDepartmentId?: string | null
  } | null,
  fallbackDepartmentIds?: string[]
): string[] {
  const ids = new Set<string>()
  for (const id of fallbackDepartmentIds ?? []) {
    if (id) ids.add(id)
  }
  for (const id of currentStaff?.departmentIds ?? []) {
    if (id) ids.add(id)
  }
  if (currentStaff?.primaryDepartmentId) {
    ids.add(currentStaff.primaryDepartmentId)
  }
  return Array.from(ids)
}

/**
 * Build standard task permission matrix flags from `useOrganization().hasPermission`.
 */
export function buildTaskMatrixPerms(
  hasPermission?: (action: any) => boolean
): Partial<Record<string, boolean>> {
  if (!hasPermission) return {}
  return {
    'task:assign': hasPermission('task:assign'),
    'task:change_status': hasPermission('task:change_status'),
    'task:complete_assigned': hasPermission('task:complete_assigned'),
    'task:edit_own': hasPermission('task:edit_own'),
    'task:edit_all': hasPermission('task:edit_all'),
    'task:delete_own': hasPermission('task:delete_own'),
    'task:delete_all': hasPermission('task:delete_all'),
  }
}

/**
 * Build unified actor context for task components (TaskDetail, KanbanBoard, SubtaskList,
 * DocumentTaskSection, TaskBulkActions). Defaults to least-privileged role 'nhan_vien'.
 */
export function buildTaskActorContext(params: {
  staffId?: string | null
  staffName?: string | null
  role?: string | null
  isAdmin?: boolean
  currentStaff?: {
    departmentIds?: string[] | null
    primaryDepartmentId?: string | null
  } | null
  hasPermission?: (action: any) => boolean
  fallbackId?: string
  fallbackName?: string
  fallbackDepartmentIds?: string[]
}): {
  id: string
  name: string
  actorId: string
  actorName: string
  role: 'admin' | 'staff' | 'guest'
  rawRole: string
  departmentIds: string[]
  matrixPerms: Partial<Record<string, boolean>>
  userCtx: StaffContext
  actor: TaskActorPayload
} {
  const isAdmin = Boolean(params.isAdmin || params.role === 'admin')
  const rawRole = isAdmin ? 'admin' : params.role || 'nhan_vien'
  const normalizedRole = normalizeTaskActorRole(rawRole, isAdmin)
  const actorId = params.staffId || params.fallbackId || 'unknown'
  const actorName =
    params.staffName || params.fallbackName || (isAdmin ? 'Admin' : 'Thành viên')
  const departmentIds = extractActorDepartmentIds(
    params.currentStaff,
    params.fallbackDepartmentIds
  )
  const matrixPerms = buildTaskMatrixPerms(params.hasPermission)
  const userCtx: StaffContext = {
    id: actorId,
    role: normalizedRole,
    departmentIds,
  }
  const actor: TaskActorPayload = {
    id: actorId,
    name: actorName,
    role: rawRole,
    departmentIds,
    matrixPerms,
  }
  return {
    id: actorId,
    name: actorName,
    actorId,
    actorName,
    role: normalizedRole,
    rawRole,
    departmentIds,
    matrixPerms,
    userCtx,
    actor,
  }
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
  if (user.role === 'guest') return false
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
  if (user.role === 'guest') return false
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
 * Allowed: admin, creator, assignee (with complete_assigned), or department manager with task:change_status.
 */
export function canChangeStatus(
  user: StaffContext,
  task: TaskContext,
  matrixPerms?: Partial<Record<string, boolean>>
): boolean {
  if (user.role === 'guest') return false
  if (user.role === 'admin') return true

  const isOwner = task.createdBy === user.id
  const isAssignee = task.assigneeId === user.id

  if (matrixPerms) {
    if (matrixPerms['task:change_status']) {
      const inDepartment = task.departmentId != null && user.departmentIds.includes(task.departmentId)
      const inCooperating = task.cooperatingDepartmentIds.some(d => user.departmentIds.includes(d))
      return isOwner || isAssignee || inDepartment || inCooperating
    }
    if (matrixPerms['task:complete_assigned']) {
      return isOwner || isAssignee
    }
  }

  return isOwner || isAssignee
}

// ===== Assign =====

/**
 * Can this user assign/reassign the task to someone else?
 * Allowed: admin, creator, or user with `task:assign` permission in scope.
 * NOT allowed: assignee without `task:assign`, collaborator, follower, guest.
 */
export function canAssignTask(
  user: StaffContext,
  task?: TaskContext,
  matrixPerms?: Partial<Record<string, boolean>>
): boolean {
  if (user.role === 'guest') return false
  if (user.role === 'admin') return true

  if (matrixPerms) {
    if (!matrixPerms['task:assign']) return false
    if (!task) return true
    const isOwner = task.createdBy === user.id
    const inDepartment = task.departmentId != null && user.departmentIds.includes(task.departmentId)
    const inCooperating = task.cooperatingDepartmentIds.some(d => user.departmentIds.includes(d))
    return isOwner || inDepartment || inCooperating || task.departmentId == null
  }

  if (!task) return false
  return task.createdBy === user.id
}

// ===== Comment =====

/**
 * Can this user add comments to this task?
 * Allowed: admin, creator, assignee, collaborator.
 * NOT allowed: follower (view only), guest.
 */
export function canAddComment(user: StaffContext, task: TaskContext): boolean {
  if (user.role === 'guest') return false
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
