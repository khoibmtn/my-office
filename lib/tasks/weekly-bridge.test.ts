import { describe, it, expect } from 'vitest'
import {
  appendTaskWorkItemPure,
  formatPeriodBanner,
  getDefaultWeeklyPeriod,
  groupTasksForWeeklyPeriod,
  shiftWeeklyPeriod,
  timestampToVNDate,
} from './weekly-bridge'
import { resolvePeriod } from '@/lib/weekly-report/period'
import type { Task } from '@/types/tasks'
import type { WorkItem } from '@/types/weekly-report'

function mockTs(iso: string) {
  const ms = Date.parse(iso)
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
    toMillis: () => ms,
    toDate: () => new Date(ms),
  } as any
}

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    taskCode: null,
    description: null,
    type: 'single',
    status: 'pending',
    priority: 'normal',
    progress: 0,
    progressMode: 'manual',
    isClosed: false,
    startDate: null,
    dueDate: null,
    completedAt: null,
    estimatedMinutes: null,
    occurrenceDate: null,
    visibleFrom: null,
    createdBy: 'admin',
    assigneeId: 'admin',
    assigneeName: 'Admin',
    collaboratorIds: [],
    followerIds: [],
    departmentId: null,
    cooperatingDepartmentIds: [],
    assigneeDepartmentId: null,
    blockedReason: null,
    blockedByTaskIds: [],
    blockedNote: null,
    previousStatus: null,
    dossierIds: [],
    documentIds: [],
    parentTaskId: null,
    dependsOnTaskIds: [],
    relatedTaskIds: [],
    seriesId: null,
    occurrenceKey: null,
    templateId: null,
    tagIds: [],
    attachments: [],
    source: 'manual',
    createdAt: mockTs('2026-11-13T08:00:00+07:00'),
    updatedAt: mockTs('2026-11-13T08:00:00+07:00'),
    deletedAt: null,
    migratedFromChecklistId: null,
    ...overrides,
  }
}

describe('weekly-bridge pure helpers', () => {
  it('converts timestamps to Vietnam calendar dates regardless of process TZ', () => {
    expect(timestampToVNDate(mockTs('2026-11-12T17:00:00.000Z'))).toBe('2026-11-13')
    expect(timestampToVNDate(mockTs('2026-11-19T23:59:59+07:00'))).toBe('2026-11-19')
    expect(timestampToVNDate(null)).toBeNull()
  })

  it('formats period banner as "Giao ban dd/MM · kỳ dd/MM–dd/MM"', () => {
    const period = resolvePeriod('2026-11-20', [])
    expect(period.periodStart).toBe('2026-11-13')
    expect(period.periodEnd).toBe('2026-11-19')
    expect(formatPeriodBanner(period)).toBe('Giao ban 20/11 · kỳ 13/11–19/11')
    expect(formatPeriodBanner(period, '2026-11-19')).toBe('Giao ban 19/11 · kỳ 13/11–19/11')
  })

  it('resolves default and shifted weekly periods from Friday -> Thursday', () => {
    const { weekId, period } = getDefaultWeeklyPeriod([], new Date('2026-11-18T10:00:00+07:00'))
    expect(weekId).toBe('2026-11-20')
    expect(period.periodStart).toBe('2026-11-13')
    expect(period.periodEnd).toBe('2026-11-19')

    const prev = shiftWeeklyPeriod(weekId, -1, [])
    expect(prev.weekId).toBe('2026-11-13')
    expect(prev.periodStart).toBe('2026-11-06')
    expect(prev.periodEnd).toBe('2026-11-12')
  })

  it('groups tasks accurately into overdue, dueInPeriod, completedInPeriod, unscheduledOpen', () => {
    const period = resolvePeriod('2026-11-20', []) // 2026-11-13 .. 2026-11-19
    const now = Date.parse('2026-11-18T10:00:00+07:00')

    const tasks: Task[] = [
      // Overdue from earlier week
      makeTask({
        id: 't-overdue-old',
        title: 'Việc quá hạn tuần trước',
        dueDate: mockTs('2026-11-10T23:59:59+07:00'),
      }),
      // Overdue inside current period (must only appear in overdue, not dueInPeriod)
      makeTask({
        id: 't-overdue-in-period',
        title: 'Việc quá hạn trong kỳ',
        dueDate: mockTs('2026-11-16T23:59:59+07:00'),
      }),
      // Due later in current period
      makeTask({
        id: 't-due-period',
        title: 'Báo cáo tuần giao ban',
        dueDate: mockTs('2026-11-19T23:59:59+07:00'),
      }),
      // Due next period (excluded from this period)
      makeTask({
        id: 't-due-next',
        title: 'Việc tuần sau',
        dueDate: mockTs('2026-11-24T23:59:59+07:00'),
      }),
      // Completed in current period
      makeTask({
        id: 't-done-period',
        title: 'Hoàn thành kế hoạch quý',
        status: 'completed',
        isClosed: true,
        completedAt: mockTs('2026-11-17T15:00:00+07:00'),
      }),
      // Completed in previous period (excluded)
      makeTask({
        id: 't-done-old',
        title: 'Việc đã xong tuần trước',
        status: 'completed',
        isClosed: true,
        completedAt: mockTs('2026-11-12T15:00:00+07:00'),
      }),
      // Cancelled in period (excluded)
      makeTask({
        id: 't-cancelled',
        title: 'Việc đã hủy',
        status: 'cancelled',
        isClosed: true,
        updatedAt: mockTs('2026-11-17T15:00:00+07:00'),
      }),
      // Open without dueDate
      makeTask({
        id: 't-no-due',
        title: 'Việc chưa có hạn',
        dueDate: null,
      }),
      // Subtask (ignored)
      makeTask({
        id: 't-sub',
        title: 'Việc con',
        parentTaskId: 't-due-period',
        dueDate: mockTs('2026-11-19T23:59:59+07:00'),
      }),
      // Future visibleFrom (ignored)
      makeTask({
        id: 't-future-vis',
        title: 'Việc chưa tới ngày hiện',
        visibleFrom: mockTs('2026-11-25T00:00:00+07:00'),
        dueDate: mockTs('2026-11-19T23:59:59+07:00'),
      }),
    ]

    const groups = groupTasksForWeeklyPeriod(tasks, period, now)
    expect(groups.overdue.map((t) => t.id)).toEqual(['t-overdue-old', 't-overdue-in-period'])
    expect(groups.dueInPeriod.map((t) => t.id)).toEqual(['t-due-period'])
    expect(groups.completedInPeriod.map((t) => t.id)).toEqual(['t-done-period'])
    expect(groups.unscheduledOpen.map((t) => t.id)).toEqual(['t-no-due'])
  })

  it('appends task workItem once and avoids duplicates by taskId (AC5)', () => {
    const initial: WorkItem[] = [
      {
        id: 'w1',
        text: 'Dòng thường xuyên',
        highlight: false,
        pinned: true,
        order: 0,
        source: 'carried',
        taskId: null,
        children: [],
      },
    ]

    const first = appendTaskWorkItemPure(
      initial,
      { id: 'task-123', title: '  Hoàn thành báo cáo KHTH  ' },
      () => 'w2'
    )
    expect(first.added).toBe(true)
    expect(first.items).toHaveLength(2)
    expect(first.items[1]).toEqual({
      id: 'w2',
      text: 'Hoàn thành báo cáo KHTH',
      highlight: false,
      pinned: false,
      order: 1,
      source: 'task',
      taskId: 'task-123',
      children: [],
    })

    // Second call for same taskId must not duplicate
    const second = appendTaskWorkItemPure(
      first.items,
      { id: 'task-123', title: 'Hoàn thành báo cáo KHTH' },
      () => 'w3'
    )
    expect(second.added).toBe(false)
    expect(second.items).toHaveLength(2)
    expect(second.item.id).toBe('w2')
  })
})
