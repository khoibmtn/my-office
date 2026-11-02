import { describe, it, expect } from 'vitest'
import {
  isVisibleTask,
  computeTaskStats,
  filterTasksByParams,
  getClosedTasksSinceMs,
  mergeTaskSnapshots,
  THIRTY_DAYS_MS,
} from '@/lib/tasks/firestore'
import type { Task } from '@/types/tasks'

function mockTimestamp(isoString: string) {
  const ms = Date.parse(isoString)
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
    toMillis: () => ms,
    toDate: () => new Date(ms),
  } as any
}

describe('isVisibleTask', () => {
  const now = Date.parse('2026-11-02T10:00:00+07:00')

  it('returns true for a normal top-level active task', () => {
    const task: Partial<Task> = {
      id: 't1',
      title: 'Normal task',
      deletedAt: null,
      parentTaskId: null,
      visibleFrom: null,
    }
    expect(isVisibleTask(task, now)).toBe(true)
  })

  it('returns true when visibleFrom is in the past or equal to now', () => {
    const pastTask: Partial<Task> = {
      id: 't2',
      deletedAt: null,
      parentTaskId: null,
      visibleFrom: mockTimestamp('2026-11-02T08:00:00+07:00'),
    }
    const exactNowTask: Partial<Task> = {
      id: 't3',
      deletedAt: null,
      parentTaskId: null,
      visibleFrom: mockTimestamp('2026-11-02T10:00:00+07:00'),
    }
    expect(isVisibleTask(pastTask, now)).toBe(true)
    expect(isVisibleTask(exactNowTask, now)).toBe(true)
  })

  it('returns false when visibleFrom is in the future (e.g. recurring task generated 14 days ahead)', () => {
    const futureTask: Partial<Task> = {
      id: 't-future',
      deletedAt: null,
      parentTaskId: null,
      visibleFrom: mockTimestamp('2026-11-16T08:00:00+07:00'),
    }
    expect(isVisibleTask(futureTask, now)).toBe(false)
  })

  it('returns false for subtasks (parentTaskId != null)', () => {
    const subtask: Partial<Task> = {
      id: 't-sub',
      deletedAt: null,
      parentTaskId: 'parent-123',
      visibleFrom: null,
    }
    expect(isVisibleTask(subtask, now)).toBe(false)
  })

  it('returns false for soft-deleted tasks (deletedAt != null)', () => {
    const deletedTask: Partial<Task> = {
      id: 't-del',
      deletedAt: mockTimestamp('2026-11-01T12:00:00+07:00'),
      parentTaskId: null,
      visibleFrom: null,
    }
    expect(isVisibleTask(deletedTask, now)).toBe(false)
  })
})

describe('computeTaskStats', () => {
  // Monday 2026-11-02 00:30:00 Asia/Ho_Chi_Minh (which is Sunday 2026-11-01 17:30:00 UTC)
  const nowMondayVN = Date.parse('2026-11-02T00:30:00+07:00')

  it('correctly respects Vietnam timezone (Asia/Ho_Chi_Minh) week boundary starting Monday 00:00', () => {
    const tasks: Array<Partial<Task>> = [
      // Completed Sunday 23:59:59 VN time (previous week, but still November in VN time)
      {
        id: 'prev-week-sun',
        status: 'completed',
        isClosed: true,
        completedAt: mockTimestamp('2026-11-01T23:59:59+07:00'),
      },
      // Completed Monday 00:00:00 VN time (current week & current month)
      {
        id: 'curr-week-mon-start',
        status: 'completed',
        isClosed: true,
        completedAt: mockTimestamp('2026-11-02T00:00:00+07:00'),
      },
      // Completed Monday 00:15:00 VN time (current week & current month)
      {
        id: 'curr-week-mon-later',
        status: 'completed',
        isClosed: true,
        completedAt: mockTimestamp('2026-11-02T00:15:00+07:00'),
      },
      // Completed in October without completedAt in Nov
      {
        id: 'oct-completed',
        status: 'completed',
        isClosed: true,
        completedAt: mockTimestamp('2026-10-15T10:00:00+07:00'),
      },
      // Completed with null completedAt -> should not count in week or month
      {
        id: 'no-completed-at',
        status: 'completed',
        isClosed: true,
        completedAt: null,
      },
    ]

    const stats = computeTaskStats(tasks, nowMondayVN)
    expect(stats.completed).toBe(5)
    expect(stats.completedThisWeek).toBe(2)
    expect(stats.completedThisMonth).toBe(3)
  })

  it('correctly respects Vietnam timezone (Asia/Ho_Chi_Minh) month boundary at 00:00 on the 1st', () => {
    // 2026-11-01 00:20:00+07:00 (Oct 31 17:20:00 UTC)
    const nowNov1VN = Date.parse('2026-11-01T00:20:00+07:00')

    const tasks: Array<Partial<Task>> = [
      // Oct 31 23:59:59+07:00 -> previous month in VN
      {
        id: 'oct-end',
        status: 'completed',
        isClosed: true,
        completedAt: mockTimestamp('2026-10-31T23:59:59+07:00'),
      },
      // Nov 1 00:00:00+07:00 -> current month in VN
      {
        id: 'nov-start',
        status: 'completed',
        isClosed: true,
        completedAt: mockTimestamp('2026-11-01T00:00:00+07:00'),
      },
    ]

    const stats = computeTaskStats(tasks, nowNov1VN)
    expect(stats.completedThisMonth).toBe(1)
    // Both Oct 31 (Sat) and Nov 1 (Sun) belong to the week starting Mon Oct 26
    expect(stats.completedThisWeek).toBe(2)
  })

  it('excludes cancelled tasks from completionRate denominator: completed / (total - cancelled)', () => {
    const tasks: Array<Partial<Task>> = [
      { id: '1', status: 'completed', isClosed: true, completedAt: mockTimestamp('2026-11-02T00:10:00+07:00') },
      { id: '2', status: 'completed', isClosed: true, completedAt: mockTimestamp('2026-11-02T00:10:00+07:00') },
      { id: '3', status: 'completed', isClosed: true, completedAt: mockTimestamp('2026-11-02T00:10:00+07:00') },
      { id: '4', status: 'in_progress', isClosed: false },
      { id: '5', status: 'cancelled', isClosed: true },
      { id: '6', status: 'cancelled', isClosed: true },
    ]

    // total = 6, cancelled = 2 -> denominator = 4, completed = 3 -> 3 / 4 = 75%
    const stats = computeTaskStats(tasks, nowMondayVN)
    expect(stats.total).toBe(6)
    expect(stats.cancelled).toBe(2)
    expect(stats.completed).toBe(3)
    expect(stats.completionRate).toBe(75)
  })

  it('returns completionRate = 0 when all tasks are cancelled or list is empty', () => {
    const allCancelled: Array<Partial<Task>> = [
      { id: '1', status: 'cancelled', isClosed: true },
      { id: '2', status: 'cancelled', isClosed: true },
    ]
    expect(computeTaskStats(allCancelled, nowMondayVN).completionRate).toBe(0)
    expect(computeTaskStats([], nowMondayVN).completionRate).toBe(0)
  })

  it('calculates open, overdue, and dueIn7Days (due7) and ignores invisible tasks', () => {
    const now = Date.parse('2026-11-02T12:00:00+07:00')
    const tasks: Array<Partial<Task>> = [
      // Overdue open task
      {
        id: 'overdue-1',
        status: 'in_progress',
        isClosed: false,
        dueDate: mockTimestamp('2026-11-01T12:00:00+07:00'),
      },
      // Closed task with past dueDate -> NOT overdue
      {
        id: 'closed-past-due',
        status: 'completed',
        isClosed: true,
        dueDate: mockTimestamp('2026-11-01T12:00:00+07:00'),
        completedAt: mockTimestamp('2026-11-02T09:00:00+07:00'),
      },
      // Due within 7 days
      {
        id: 'due-7-days',
        status: 'pending',
        isClosed: false,
        dueDate: mockTimestamp('2026-11-05T12:00:00+07:00'),
      },
      // Due in 10 days -> open, but not due7
      {
        id: 'due-10-days',
        status: 'pending',
        isClosed: false,
        dueDate: mockTimestamp('2026-11-12T12:00:00+07:00'),
      },
      // Future visibleFrom -> ignored completely
      {
        id: 'future-visible',
        status: 'pending',
        isClosed: false,
        visibleFrom: mockTimestamp('2026-11-10T00:00:00+07:00'),
        dueDate: mockTimestamp('2026-11-01T12:00:00+07:00'),
      },
      // Subtask -> ignored completely
      {
        id: 'subtask-overdue',
        status: 'pending',
        isClosed: false,
        parentTaskId: 'overdue-1',
        dueDate: mockTimestamp('2026-11-01T12:00:00+07:00'),
      },
    ]

    const stats = computeTaskStats(tasks, now)
    expect(stats.total).toBe(4)
    expect(stats.open).toBe(3)
    expect(stats.overdue).toBe(1)
    expect(stats.dueIn7Days).toBe(1)
    expect(stats.due7).toBe(1)
  })
})

describe('filterTasksByParams vs computeTaskStats parity (Dashboard numbers === /tasks rows)', () => {
  // Wednesday 2026-11-04 10:00:00+07:00
  const now = Date.parse('2026-11-04T10:00:00+07:00')

  const sampleTasks: Array<Partial<Task>> = [
    // 1. Overdue pending task in dept-a, assigned to staff-1
    {
      id: 't-overdue-pending',
      title: 'Báo cáo tuần trước',
      status: 'pending',
      isClosed: false,
      assigneeId: 'staff-1',
      collaboratorIds: [],
      departmentId: 'dept-a',
      dueDate: mockTimestamp('2026-11-01T17:00:00+07:00'),
    },
    // 2. Overdue blocked task in dept-b (via assigneeDepartmentId fallback), assigned to staff-2, collaborator staff-1
    {
      id: 't-overdue-blocked',
      title: 'Xin ý kiến pháp chế',
      status: 'blocked',
      isClosed: false,
      assigneeId: 'staff-2',
      collaboratorIds: ['staff-1'],
      departmentId: null,
      assigneeDepartmentId: 'dept-b',
      dueDate: mockTimestamp('2026-11-03T09:00:00+07:00'),
    },
    // 3. Due in 7 days (in_progress) in dept-a, assigned to staff-1
    {
      id: 't-due7-inprogress',
      title: 'Chuẩn bị họp giao ban',
      status: 'in_progress',
      isClosed: false,
      assigneeId: 'staff-1',
      collaboratorIds: [],
      departmentId: 'dept-a',
      dueDate: mockTimestamp('2026-11-06T15:00:00+07:00'),
    },
    // 4. Open in_progress due > 7 days in dept-c, assigned to staff-3
    {
      id: 't-open-later',
      title: 'Kế hoạch quý 4',
      status: 'in_progress',
      isClosed: false,
      assigneeId: 'staff-3',
      collaboratorIds: ['staff-1'],
      departmentId: 'dept-c',
      dueDate: mockTimestamp('2026-11-25T17:00:00+07:00'),
    },
    // 5. Completed this week (Mon Nov 2 2026 VN time) in dept-a, assigned to staff-1
    {
      id: 't-done-this-week',
      title: 'Tổng hợp nhân sự',
      status: 'completed',
      isClosed: true,
      assigneeId: 'staff-1',
      collaboratorIds: [],
      departmentId: 'dept-a',
      completedAt: mockTimestamp('2026-11-02T14:00:00+07:00'),
    },
    // 6. Completed earlier this month (Sun Nov 1 2026 VN time -> previous week, same month) in dept-b, assigned to staff-2
    {
      id: 't-done-this-month-prev-week',
      title: 'Kiểm kê tài sản đầu tháng',
      status: 'completed',
      isClosed: true,
      assigneeId: 'staff-2',
      collaboratorIds: [],
      departmentId: 'dept-b',
      completedAt: mockTimestamp('2026-11-01T16:00:00+07:00'),
    },
    // 7. Completed last month (Oct 2026) in dept-a
    {
      id: 't-done-last-month',
      title: 'Báo cáo tháng 10',
      status: 'completed',
      isClosed: true,
      assigneeId: 'staff-1',
      collaboratorIds: [],
      departmentId: 'dept-a',
      completedAt: mockTimestamp('2026-10-20T10:00:00+07:00'),
    },
    // 8. Cancelled task (no completedAt) in dept-b
    {
      id: 't-cancelled',
      title: 'Việc đã huỷ',
      status: 'cancelled',
      isClosed: true,
      assigneeId: 'staff-2',
      collaboratorIds: [],
      departmentId: 'dept-b',
      completedAt: null,
    },
    // 9. Subtask (should be excluded by both computeTaskStats and filterTasksByParams)
    {
      id: 't-subtask',
      title: 'Việc con',
      status: 'pending',
      isClosed: false,
      parentTaskId: 't-overdue-pending',
      assigneeId: 'staff-1',
      departmentId: 'dept-a',
      dueDate: mockTimestamp('2026-11-01T17:00:00+07:00'),
    },
    // 10. Future visibleFrom (should be excluded by both)
    {
      id: 't-future',
      title: 'Việc định kỳ tương lai',
      status: 'pending',
      isClosed: false,
      visibleFrom: mockTimestamp('2026-11-15T00:00:00+07:00'),
      assigneeId: 'staff-1',
      departmentId: 'dept-a',
      dueDate: mockTimestamp('2026-11-01T17:00:00+07:00'),
    },
  ]

  it('matches every global Dashboard stat card with /tasks filterTasksByParams row count and exact expected numbers', () => {
    const stats = computeTaskStats(sampleTasks, now)

    // Verify exact absolute values on fixed dataset:
    // total=8 visible tasks (10 total minus 1 subtask and 1 future visibleFrom)
    expect(stats.total).toBe(8)
    expect(stats.overdue).toBe(2) // t-overdue-pending, t-overdue-blocked
    expect(stats.dueIn7Days).toBe(1) // t-due7-inprogress
    expect(stats.due7).toBe(1)
    expect(stats.open).toBe(4) // 1 pending + 2 in_progress + 1 blocked
    expect(stats.pending).toBe(1)
    expect(stats.inProgress).toBe(2)
    expect(stats.blocked).toBe(1)
    expect(stats.completedThisWeek).toBe(1) // t-done-this-week
    expect(stats.completedThisMonth).toBe(2) // t-done-this-week, t-done-this-month-prev-week
    expect(stats.completed).toBe(3)
    expect(stats.cancelled).toBe(1)

    // Verify filterTasksByParams produces the exact same absolute counts and matches stats:
    expect(filterTasksByParams(sampleTasks, { status: 'all' }, now)).toHaveLength(8)
    expect(filterTasksByParams(sampleTasks, { status: 'overdue' }, now)).toHaveLength(2)
    expect(filterTasksByParams(sampleTasks, { status: 'due7' }, now)).toHaveLength(1)
    expect(filterTasksByParams(sampleTasks, { status: 'open' }, now)).toHaveLength(4)
    expect(filterTasksByParams(sampleTasks, { status: 'pending' }, now)).toHaveLength(1)
    expect(filterTasksByParams(sampleTasks, { status: 'in_progress' }, now)).toHaveLength(2)
    expect(filterTasksByParams(sampleTasks, { status: 'blocked' }, now)).toHaveLength(1)
    expect(filterTasksByParams(sampleTasks, { status: 'done_week' }, now)).toHaveLength(1)
    expect(filterTasksByParams(sampleTasks, { status: 'done_month' }, now)).toHaveLength(2)
    expect(filterTasksByParams(sampleTasks, { status: 'completed' }, now)).toHaveLength(3)
    expect(filterTasksByParams(sampleTasks, { status: 'cancelled' }, now)).toHaveLength(1)
  })

  it('matches multi-department scope (truong_phong/pho_phong managing >=2 departments: departmentId=dept-a,dept-b)', () => {
    const deptParam = 'dept-a,dept-b'
    const scopedTasks = filterTasksByParams(sampleTasks, { departmentId: deptParam }, now)
    const deptStats = computeTaskStats(scopedTasks, now)

    // Exact absolute assertions for dept-a + dept-b (7 visible tasks; excludes t-open-later in dept-c)
    expect(deptStats.total).toBe(7)
    expect(deptStats.overdue).toBe(2)
    expect(deptStats.dueIn7Days).toBe(1)
    expect(deptStats.open).toBe(3)
    expect(deptStats.inProgress).toBe(1)
    expect(deptStats.completedThisWeek).toBe(1)

    expect(
      filterTasksByParams(sampleTasks, { departmentId: deptParam, status: 'overdue' }, now)
    ).toHaveLength(2)
    expect(
      filterTasksByParams(sampleTasks, { departmentId: deptParam, status: 'due7' }, now)
    ).toHaveLength(1)
    expect(
      filterTasksByParams(sampleTasks, { departmentId: deptParam, status: 'open' }, now)
    ).toHaveLength(3)
    expect(
      filterTasksByParams(sampleTasks, { departmentId: deptParam, status: 'in_progress' }, now)
    ).toHaveLength(1)
    expect(
      filterTasksByParams(sampleTasks, { departmentId: deptParam, status: 'done_week' }, now)
    ).toHaveLength(1)
  })

  it('matches personal scope with includeCollaborator=1 (assigneeId OR collaboratorIds)', () => {
    const personalParams = { assigneeId: 'staff-1', includeCollaborator: true }
    const personalTasks = filterTasksByParams(sampleTasks, { ...personalParams }, now)
    const personalStats = computeTaskStats(personalTasks, now)

    // staff-1 is assignee on 4 visible tasks + collaborator on 2 visible tasks = 6 tasks total
    expect(personalTasks).toHaveLength(6)
    expect(personalStats.overdue).toBe(2)
    expect(personalStats.dueIn7Days).toBe(1)
    expect(personalStats.open).toBe(4)
    expect(personalStats.inProgress).toBe(2)
    expect(personalStats.completedThisWeek).toBe(1)

    expect(
      filterTasksByParams(sampleTasks, { ...personalParams, status: 'overdue' }, now)
    ).toHaveLength(2)
    expect(
      filterTasksByParams(sampleTasks, { ...personalParams, status: 'due7' }, now)
    ).toHaveLength(1)
    expect(
      filterTasksByParams(sampleTasks, { ...personalParams, status: 'open' }, now)
    ).toHaveLength(4)
    expect(
      filterTasksByParams(sampleTasks, { ...personalParams, status: 'in_progress' }, now)
    ).toHaveLength(2)
    expect(
      filterTasksByParams(sampleTasks, { ...personalParams, status: 'done_week' }, now)
    ).toHaveLength(1)
  })

  it('matches per-person table links (assigneeId without includeCollaborator) for overdue, due7, open', () => {
    for (const staffId of ['staff-1', 'staff-2', 'staff-3']) {
      const assigneeTasks = filterTasksByParams(sampleTasks, { assigneeId: staffId }, now)
      const assigneeStats = computeTaskStats(assigneeTasks, now)

      expect(
        filterTasksByParams(sampleTasks, { assigneeId: staffId, status: 'overdue' }, now)
      ).toHaveLength(assigneeStats.overdue)
      expect(
        filterTasksByParams(sampleTasks, { assigneeId: staffId, status: 'due7' }, now)
      ).toHaveLength(assigneeStats.dueIn7Days)
      expect(
        filterTasksByParams(sampleTasks, { assigneeId: staffId, status: 'open' }, now)
      ).toHaveLength(assigneeStats.open)
    }
  })
})

describe('getClosedTasksSinceMs (min(now - 30 days, start of current month VN))', () => {
  it('uses start of current month in VN time when now is on the 31st of a month (more than 30 days after 1st 00:00)', () => {
    // 2026-10-31 23:00:00+07:00 -> now - 30 days is 2026-10-01 23:00:00+07:00
    // Start of October VN is 2026-10-01 00:00:00+07:00
    const nowOct31 = Date.parse('2026-10-31T23:00:00+07:00')
    const oct1StartVN = Date.parse('2026-10-01T00:00:00+07:00')

    expect(getClosedTasksSinceMs(nowOct31)).toBe(oct1StartVN)
    expect(getClosedTasksSinceMs(nowOct31)).toBeLessThan(nowOct31 - THIRTY_DAYS_MS)
  })

  it('uses now - 30 days when earlier in the month', () => {
    const nowNov4 = Date.parse('2026-11-04T10:00:00+07:00')
    expect(getClosedTasksSinceMs(nowNov4)).toBe(nowNov4 - THIRTY_DAYS_MS)
  })
})

describe('mergeTaskSnapshots (prevents newly closed tasks from disappearing while serverTimestamp is pending)', () => {
  const baseOpenTask: Task = {
    id: 'task-1',
    title: 'Việc đang mở',
    status: 'in_progress',
    isClosed: false,
    deletedAt: null,
    createdAt: mockTimestamp('2026-11-01T08:00:00+07:00'),
    updatedAt: mockTimestamp('2026-11-01T09:00:00+07:00'),
  } as unknown as Task

  const otherOpenTask: Task = {
    id: 'task-2',
    title: 'Việc mở thứ 2',
    status: 'pending',
    isClosed: false,
    deletedAt: null,
    createdAt: mockTimestamp('2026-11-02T08:00:00+07:00'),
    updatedAt: mockTimestamp('2026-11-02T08:00:00+07:00'),
  } as unknown as Task

  it('retains a task that just left openTasks (closed) before closedTasks listener emits it', () => {
    const previousMerged = [otherOpenTask, baseOpenTask]
    // task-1 just became isClosed=true with pending serverTimestamp() -> openTasks drops it, closedTasks does not have it yet
    const nextOpen = [otherOpenTask]
    const nextClosed: Task[] = []

    const merged = mergeTaskSnapshots(nextOpen, nextClosed, previousMerged)
    expect(merged).toHaveLength(2)

    const retained = merged.find((t) => t.id === 'task-1')
    expect(retained).toBeDefined()
    expect(retained?.isClosed).toBe(true)
    expect(retained?.status).toBe('completed')
  })

  it('does not retain anything when the closed listener has failed', () => {
    const merged = mergeTaskSnapshots([otherOpenTask], [], [otherOpenTask, baseOpenTask], undefined, {
      allowRetain: false,
    })
    expect(merged.map((t) => t.id)).toEqual(['task-2'])
  })

  it('stops retaining a ghost task after maxRetainMs', () => {
    const retainedSince = new Map<string, number>()
    const first = mergeTaskSnapshots([otherOpenTask], [], [otherOpenTask, baseOpenTask], undefined, {
      now: 1_000,
      retainedSince,
      maxRetainMs: 30_000,
    })
    expect(first.find((t) => t.id === 'task-1')).toBeDefined()

    const stillWithin = mergeTaskSnapshots([otherOpenTask], [], first, undefined, {
      now: 20_000,
      retainedSince,
      maxRetainMs: 30_000,
    })
    expect(stillWithin.find((t) => t.id === 'task-1')).toBeDefined()

    const expired = mergeTaskSnapshots([otherOpenTask], [], stillWithin, undefined, {
      now: 40_000,
      retainedSince,
      maxRetainMs: 30_000,
    })
    expect(expired.find((t) => t.id === 'task-1')).toBeUndefined()
    expect(retainedSince.has('task-1')).toBe(false)
  })

  it('clears the retention timer once a listener delivers the task again (reopened)', () => {
    const retainedSince = new Map<string, number>([['task-1', 0]])
    const merged = mergeTaskSnapshots([otherOpenTask, baseOpenTask], [], [], undefined, {
      now: 100_000,
      retainedSince,
    })
    expect(merged.find((t) => t.id === 'task-1')?.isClosed).toBe(false)
    expect(retainedSince.has('task-1')).toBe(false)
  })

  it('prefers closedTasks snapshot when updatedAt is pending (null) or newer than openTasks snapshot', () => {
    const closedWithPendingTimestamp: Task = {
      ...baseOpenTask,
      status: 'completed',
      isClosed: true,
      updatedAt: null as any,
    }

    const merged = mergeTaskSnapshots([baseOpenTask], [closedWithPendingTimestamp], [baseOpenTask])
    expect(merged).toHaveLength(1)
    expect(merged[0].isClosed).toBe(true)
    expect(merged[0].status).toBe('completed')
  })

  it('immediately removes soft-deleted tasks and never retains them from previousTasks', () => {
    const previousMerged = [otherOpenTask, baseOpenTask]
    const deletedIds = new Set(['task-1'])

    const merged = mergeTaskSnapshots([otherOpenTask], [], previousMerged, deletedIds)
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('task-2')
  })
})
