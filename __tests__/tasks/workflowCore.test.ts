import { describe, it, expect } from 'vitest'
import {
  buildCreateTaskPayload,
  planStatusChange,
  planBulkTaskUpdates,
  countPlannedBulkItemOps,
  chunkPlannedBulkItemsByOps,
  MAX_BATCH_OPS,
  buildUnblockRestoreFields,
  planDependencyStatusUpdate,
  type PlannedBulkTaskItem,
} from '@/lib/tasks/mutations'
import {
  validateDependencyList,
  isSubtaskClosed,
  hasIncompleteSubtasksFromList,
  computeParentSubtaskProgress,
} from '@/lib/tasks/validation'
import { buildTaskActorContext, normalizeTaskActorRole } from '@/lib/tasks/permissions'
import type { Task } from '@/types/tasks'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    taskCode: null,
    title: 'Công việc thử nghiệm',
    description: null,
    type: 'single',
    status: 'in_progress',
    priority: 'normal',
    progress: 40,
    progressMode: 'manual',
    isClosed: false,
    parentTaskId: null,
    sortOrder: 0,
    dependsOnTaskIds: [],
    relatedTaskIds: [],
    blockedReason: null,
    blockedByTaskIds: [],
    blockedNote: null,
    previousStatus: null,
    createdBy: 'creator-1',
    assigneeId: 'staff-1',
    assigneeName: 'Nhân viên 1',
    assigneeDepartmentId: 'dept-1',
    collaboratorIds: [],
    followerIds: ['creator-1', 'staff-1'],
    departmentId: 'dept-1',
    cooperatingDepartmentIds: [],
    startDate: null,
    dueDate: null,
    completedAt: null,
    estimatedMinutes: null,
    occurrenceDate: null,
    visibleFrom: null,
    documentIds: [],
    dossierIds: [],
    tagIds: [],
    attachments: [],
    source: 'manual',
    templateId: null,
    seriesId: null,
    occurrenceKey: null,
    previousTaskId: null,
    createdAt: { seconds: 1000 } as any,
    updatedAt: { seconds: 1000 } as any,
    deletedAt: null,
    migratedFromChecklistId: null,
    ...overrides,
  }
}

describe('buildCreateTaskPayload', () => {
  it('saves all fields, blocks when dependencies are incomplete, sets source=template when templateId present, and notifies assignee + collaborators (excluding creator)', () => {
    const { taskData, notificationRecipients } = buildCreateTaskPayload(
      {
        title: 'Báo cáo quý',
        estimatedMinutes: 90,
        templateId: 'tpl-monthly',
        dependsOnTaskIds: ['dep-done', 'dep-open'],
        assigneeId: 'staff-2',
        assigneeName: 'Nhân viên 2',
        assigneeDepartmentId: 'dept-finance',
        collaboratorIds: ['staff-3', 'creator-1'],
      },
      'creator-1',
      ['dep-open']
    )

    expect(taskData.title).toBe('Báo cáo quý')
    expect(taskData.status).toBe('blocked')
    expect(taskData.blockedReason).toBe('dependency')
    expect(taskData.blockedByTaskIds).toEqual(['dep-open'])
    expect(taskData.previousStatus).toBe('pending')
    expect(taskData.dependsOnTaskIds).toEqual(['dep-done', 'dep-open'])
    expect(taskData.estimatedMinutes).toBe(90)
    expect(taskData.templateId).toBe('tpl-monthly')
    expect(taskData.source).toBe('template')
    expect(taskData.assigneeDepartmentId).toBe('dept-finance')
    expect(notificationRecipients.allRecipients).toEqual(['staff-2', 'staff-3'])
  })

  it('inherits assigneeId, departmentId, dueDate from parentTask when creating a subtask', () => {
    const dueTs = { seconds: 2000 } as any
    const { taskData } = buildCreateTaskPayload(
      {
        title: 'Việc con 1',
        parentTaskId: 'parent-1',
      },
      'creator-1',
      [],
      {
        assigneeId: 'staff-parent',
        assigneeName: 'NV Cha',
        assigneeDepartmentId: 'dept-parent',
        departmentId: 'dept-main',
        dueDate: dueTs,
      }
    )

    expect(taskData.assigneeId).toBe('staff-parent')
    expect(taskData.assigneeName).toBe('NV Cha')
    expect(taskData.assigneeDepartmentId).toBe('dept-parent')
    expect(taskData.departmentId).toBe('dept-main')
    expect(taskData.dueDate).toBe(dueTs)
  })
})

describe('planStatusChange', () => {
  const adminActor = {
    id: 'admin-1',
    name: 'Admin',
    role: 'admin' as const,
    departmentIds: [],
  }

  it('blocks completing a parent task when subtasks are incomplete', () => {
    const parent = makeTask({ status: 'in_progress' })
    const plan = planStatusChange(parent, 'completed', adminActor, {
      subtasks: [
        { id: 'sub-1', status: 'completed', deletedAt: null, isClosed: true },
        { id: 'sub-2', status: 'pending', deletedAt: null, isClosed: false },
      ],
    })

    expect(plan.valid).toBe(false)
    expect(plan.error).toContain('còn việc con (subtask) chưa xong')
  })

  it('sets completedAt, progress=100, isClosed=true, eventType=COMPLETED when completing', () => {
    const task = makeTask({ status: 'in_progress', progress: 50 })
    const plan = planStatusChange(task, 'completed', adminActor)

    expect(plan.valid).toBe(true)
    expect(plan.setCompletedAt).toBe(true)
    expect(plan.updates?.progress).toBe(100)
    expect(plan.updates?.isClosed).toBe(true)
    expect(plan.eventType).toBe('COMPLETED')
  })

  it('clears completedAt, sets isClosed=false, and resets/recalculates progress when reopening', () => {
    const completedTask = makeTask({
      status: 'completed',
      isClosed: true,
      progress: 100,
      progressMode: 'manual',
      completedAt: { seconds: 1500 } as any,
    })

    const planManual = planStatusChange(completedTask, 'pending', adminActor)
    expect(planManual.valid).toBe(true)
    expect(planManual.clearCompletedAt).toBe(true)
    expect(planManual.updates?.isClosed).toBe(false)
    expect(planManual.updates?.progress).toBe(0)
    expect(planManual.eventType).toBe('REOPENED')

    const subtaskModeTask = makeTask({
      status: 'completed',
      isClosed: true,
      progress: 100,
      progressMode: 'subtask',
      completedAt: { seconds: 1500 } as any,
    })
    const planSubtask = planStatusChange(subtaskModeTask, 'pending', adminActor, {
      subtasks: [
        { id: 's1', status: 'completed', deletedAt: null, isClosed: true },
        { id: 's2', status: 'pending', deletedAt: null, isClosed: false },
      ],
    })
    expect(planSubtask.valid).toBe(true)
    expect(planSubtask.clearCompletedAt).toBe(true)
    expect(planSubtask.updates?.progress).toBe(50)
  })

  it('clears blockedReason, blockedByTaskIds, blockedNote, previousStatus and logs UNBLOCKED when leaving blocked', () => {
    const blockedTask = makeTask({
      status: 'blocked',
      blockedReason: 'dependency',
      blockedByTaskIds: ['dep-1'],
      blockedNote: 'Chờ số liệu',
      previousStatus: 'in_progress',
    })

    const plan = planStatusChange(blockedTask, 'in_progress', adminActor)
    expect(plan.valid).toBe(true)
    expect(plan.updates?.blockedReason).toBeNull()
    expect(plan.updates?.blockedByTaskIds).toEqual([])
    expect(plan.updates?.blockedNote).toBeNull()
    expect(plan.updates?.previousStatus).toBeNull()
    expect(plan.eventType).toBe('UNBLOCKED')
  })
})

describe('planBulkTaskUpdates', () => {
  const adminActor = {
    id: 'admin-1',
    name: 'Admin',
    role: 'admin' as const,
    departmentIds: [],
  }

  it('skips invalid tasks with reasons and updates valid tasks', () => {
    const tValid = makeTask({ id: 't-valid', status: 'in_progress' })
    const tParentWithOpenSub = makeTask({ id: 't-parent', status: 'in_progress' })
    const tInvalidTransition = makeTask({ id: 't-pending', status: 'pending' })

    const result = planBulkTaskUpdates(
      ['t-valid', 't-parent', 't-pending'],
      {
        't-valid': tValid,
        't-parent': tParentWithOpenSub,
        't-pending': tInvalidTransition,
      },
      { status: 'completed' },
      adminActor,
      {
        subtasksByParentId: {
          't-parent': [{ id: 'sub-open', status: 'pending', deletedAt: null, isClosed: false }],
        },
      }
    )

    expect(result.planned).toHaveLength(1)
    expect(result.planned[0].taskId).toBe('t-valid')
    expect(result.skipped).toHaveLength(2)
    expect(result.skipped.map((s) => s.id)).toEqual(['t-parent', 't-pending'])
  })

  it('does not log STATUS_CHANGED when status is not changed', () => {
    const t1 = makeTask({ id: 't-1', status: 'pending', priority: 'normal' })
    const result = planBulkTaskUpdates(
      ['t-1'],
      { 't-1': t1 },
      { priority: 'high' },
      adminActor
    )

    expect(result.planned).toHaveLength(1)
    expect(
      result.planned[0].activities.some((a) => a.eventType === 'STATUS_CHANGED')
    ).toBe(false)
    expect(result.planned[0].activities[0]?.eventType).toBe('PRIORITY_CHANGED')
  })
})

describe('validateDependencyList', () => {
  it('blocks self-dependency and dependency cycles with Vietnamese message', () => {
    expect(validateDependencyList('A', ['A'], {}).valid).toBe(false)

    const graph = {
      B: ['C'],
      C: ['A'],
    }
    const res = validateDependencyList('A', ['B'], graph)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('phụ thuộc vòng')
  })
})

describe('Round 1 fixes: least-privilege role & subtask completion/progress & batch chunking', () => {
  it('defaults missing actor role to least-privileged staff (never admin) and rejects unauthorized status changes', () => {
    expect(normalizeTaskActorRole(undefined, false)).toBe('staff')
    expect(normalizeTaskActorRole('nhan_vien', false)).toBe('staff')
    expect(normalizeTaskActorRole('admin', false)).toBe('admin')

    const actorCtx = buildTaskActorContext({
      staffId: 'stranger-1',
      staffName: 'Nhân viên ngoài',
      isAdmin: false,
      role: 'nhan_vien',
      currentStaff: { departmentIds: ['dept-2'], primaryDepartmentId: 'dept-2' },
    })
    expect(actorCtx.role).toBe('staff')
    expect(actorCtx.departmentIds).toEqual(['dept-2'])

    const task = makeTask({
      status: 'in_progress',
      createdBy: 'creator-1',
      assigneeId: 'staff-1',
      departmentId: 'dept-1',
    })

    // Actor with omitted role must default to least-privileged ('nhan_vien' -> 'staff'), not 'admin'
    const plan = planStatusChange(task, 'completed', {
      id: 'stranger-1',
      name: 'Nhân viên ngoài',
    })
    expect(plan.valid).toBe(false)
    expect(plan.error).toContain('không có quyền')
  })

  it('does not block completing a parent task when subtasks are cancelled, but blocks when any subtask is open', () => {
    const subtasksWithCancelled = [
      { id: 's1', status: 'completed' as const, isClosed: true, deletedAt: null },
      { id: 's2', status: 'cancelled' as const, isClosed: false, deletedAt: null },
    ]
    expect(isSubtaskClosed(subtasksWithCancelled[0])).toBe(true)
    expect(isSubtaskClosed(subtasksWithCancelled[1])).toBe(true)
    expect(hasIncompleteSubtasksFromList(subtasksWithCancelled)).toBe(false)

    const parent = makeTask({ status: 'in_progress' })
    const planAllowed = planStatusChange(
      parent,
      'completed',
      { id: 'admin-1', name: 'Admin', role: 'admin' },
      { subtasks: subtasksWithCancelled }
    )
    expect(planAllowed.valid).toBe(true)

    const subtasksWithOpen = [
      ...subtasksWithCancelled,
      { id: 's3', status: 'in_progress' as const, isClosed: false, deletedAt: null },
    ]
    expect(hasIncompleteSubtasksFromList(subtasksWithOpen)).toBe(true)
  })

  it('excludes cancelled subtasks from the denominator in computeParentSubtaskProgress', () => {
    // 1 completed, 1 pending, 1 cancelled -> 1 / 2 = 50%
    const progress = computeParentSubtaskProgress([
      { status: 'completed', isClosed: true, deletedAt: null },
      { status: 'pending', isClosed: false, deletedAt: null },
      { status: 'cancelled', isClosed: true, deletedAt: null },
    ])
    expect(progress).toBe(50)

    // 2 completed, 1 cancelled -> 2 / 2 = 100%
    expect(
      computeParentSubtaskProgress([
        { status: 'completed', isClosed: true, deletedAt: null },
        { status: 'completed', isClosed: true, deletedAt: null },
        { status: 'cancelled', isClosed: false, deletedAt: null },
      ])
    ).toBe(100)

    // All cancelled -> 0%
    expect(
      computeParentSubtaskProgress([
        { status: 'cancelled', isClosed: true, deletedAt: null },
      ])
    ).toBe(0)
  })

  it('ignores client-supplied blocked state when dependsOnTaskIds are all completed on server', () => {
    const { taskData } = buildCreateTaskPayload(
      {
        title: 'Việc có phụ thuộc đã xong',
        status: 'blocked',
        blockedReason: 'dependency',
        blockedByTaskIds: ['fake-client-id'],
        dependsOnTaskIds: ['dep-already-completed'],
      },
      'creator-1',
      [] // Server checkDependenciesCompleted found 0 uncompleted dependencies
    )

    expect(taskData.status).toBe('pending')
    expect(taskData.blockedReason).toBeNull()
    expect(taskData.blockedByTaskIds).toEqual([])
  })

  it('does not auto-block completed/cancelled tasks when adding dependencies, and restores open blocked tasks', () => {
    const completedTask = makeTask({
      status: 'completed',
      isClosed: true,
    })
    expect(planDependencyStatusUpdate(completedTask, ['dep-open'])).toEqual({})

    const cancelledTask = makeTask({
      status: 'cancelled',
      isClosed: true,
    })
    expect(planDependencyStatusUpdate(cancelledTask, ['dep-open'])).toEqual({})

    const openTask = makeTask({
      status: 'in_progress',
      isClosed: false,
    })
    expect(planDependencyStatusUpdate(openTask, ['dep-open'])).toEqual({
      status: 'blocked',
      isClosed: false,
      blockedReason: 'dependency',
      blockedByTaskIds: ['dep-open'],
      previousStatus: 'in_progress',
    })

    const blockedTask = makeTask({
      status: 'blocked',
      isClosed: false,
      blockedReason: 'dependency',
      blockedByTaskIds: ['dep-open'],
      previousStatus: 'in_progress',
    })
    expect(planDependencyStatusUpdate(blockedTask, [])).toEqual(
      buildUnblockRestoreFields(blockedTask)
    )
    expect(planDependencyStatusUpdate(blockedTask, [])).toEqual({
      status: 'in_progress',
      isClosed: false,
      blockedReason: null,
      blockedByTaskIds: [],
      blockedNote: null,
      previousStatus: null,
    })
  })

  it('splits bulk operations into chunks of at most 450 Firestore operations', () => {
    // Each item has 1 task update + 2 activities + 1 notification = 4 ops
    const makeItem = (idx: number): PlannedBulkTaskItem => ({
      taskId: `task-${idx}`,
      task: makeTask({ id: `task-${idx}` }),
      fields: { assigneeId: 'staff-new' },
      activities: [
        { eventType: 'REASSIGNED', metadata: { from: 'staff-1', to: 'staff-new' } },
        { eventType: 'STATUS_CHANGED', metadata: { from: 'pending', to: 'in_progress' } },
      ],
      statusChanged: true,
      becameCompleted: false,
      notifyAssigneeId: 'staff-new',
    })

    expect(countPlannedBulkItemOps(makeItem(0))).toBe(4)

    // 200 items * 4 ops = 800 ops -> at maxOps=450, each chunk holds at most floor(450/4) = 112 items (448 ops)
    const items = Array.from({ length: 200 }, (_, i) => makeItem(i))
    const chunks = chunkPlannedBulkItemsByOps(items, MAX_BATCH_OPS)

    expect(chunks.length).toBe(2)
    expect(chunks[0].length).toBe(112)
    expect(chunks[1].length).toBe(88)
    for (const chunk of chunks) {
      const totalOps = chunk.reduce((sum, item) => sum + countPlannedBulkItemOps(item), 0)
      expect(totalOps).toBeLessThanOrEqual(MAX_BATCH_OPS)
    }
  })
})
