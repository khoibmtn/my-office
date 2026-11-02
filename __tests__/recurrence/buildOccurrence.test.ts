import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const firestoreMocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}`, id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(() => 'MOCK_SERVER_TIMESTAMP'),
  Timestamp: {
    fromDate: (dt: Date) => ({ toDate: () => dt, _ms: dt.getTime() }),
  },
}))

vi.mock('firebase/firestore', () => firestoreMocks)

vi.mock('@/lib/firebase', () => ({
  db: vi.fn(() => ({ _mockDb: true })),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminFirestore: vi.fn(),
}))

import {
  buildOccurrence,
  afterCompletionDocId,
  planAfterCompletionOccurrence,
  normalizeMisfirePolicy,
  resolveWindowStart,
  getStartOfTodayInTimezone,
  createOccurrenceAdmin,
  type OccurrenceSeriesInput,
} from '@/lib/recurrence/buildOccurrence'
import { generateOccurrences } from '@/lib/recurrence/generate'
import type { RecurrenceRule } from '@/lib/recurrence/types'
import {
  persistOccurrenceTransaction,
  generateNextCompletionOccurrence,
} from '@/lib/tasks/series'
import { GET as cronGet } from '@/app/api/cron/recurrence/route'
import { getAdminFirestore } from '@/lib/firebase-admin'
import type { Task } from '@/types/tasks'

function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day, 0, 0, 0, 0)
}

const sampleSeries: OccurrenceSeriesInput = {
  id: 'series_01',
  title: 'Báo cáo giao ban',
  description: 'Tổng hợp số liệu khoa phòng',
  recurrenceType: 'calendar',
  frequency: 'daily',
  interval: 1,
  leadDays: 1,
  dueOffsetMinutes: 480,
  createdBy: 'staff_admin',
  defaultPriority: 'high',
  defaultAssigneeId: 'staff_1',
  defaultDepartmentId: 'dept_khtv',
  defaultSubtasks: [
    {
      order: 1,
      title: 'Thu thập số liệu lâm sàng',
      description: null,
      defaultAssigneeRole: null,
      estimatedMinutes: 15,
    },
    {
      order: 2,
      title: 'Kiểm tra ca trực đêm',
      description: 'Đối chiếu sổ trực',
      defaultAssigneeRole: null,
      estimatedMinutes: 10,
    },
    {
      order: 3,
      title: 'Gửi lãnh đạo duyệt',
      description: null,
      defaultAssigneeRole: null,
      estimatedMinutes: 5,
    },
  ],
}

describe('buildOccurrence — deterministic IDs', () => {
  it('generates deterministic main task ID and subtask IDs (${taskId}_st${index})', () => {
    const occDate = d(2026, 11, 2)
    const first = buildOccurrence(sampleSeries, occDate, { previousTaskId: 'series_01__2026-11-01' })
    const second = buildOccurrence(sampleSeries, occDate, { previousTaskId: 'series_01__2026-11-01' })

    expect(first.taskId).toBe('series_01__2026-11-02')
    expect(second.taskId).toBe(first.taskId)

    expect(first.subtasks).toHaveLength(3)
    expect(first.subtasks.map(s => s.id)).toEqual([
      'series_01__2026-11-02_st0',
      'series_01__2026-11-02_st1',
      'series_01__2026-11-02_st2',
    ])
    expect(second.subtasks.map(s => s.id)).toEqual(first.subtasks.map(s => s.id))
    expect(first.taskData.dueDate).toBeInstanceOf(Date)
    expect(first.taskData.occurrenceDate).toBeInstanceOf(Date)
    expect(first.taskData.visibleFrom).toBeInstanceOf(Date)
    expect(first.subtasks.every(s => s.data.parentTaskId === first.taskId)).toBe(true)
  })
})

describe('persistOccurrenceTransaction & createOccurrenceAdmin — real idempotency tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persistOccurrenceTransaction (client): sets 1 main + N subtasks when missing, and sets nothing when main already exists', async () => {
    const store = new Map<string, unknown>()
    const setSpy = vi.fn((ref: { id: string }, data: unknown) => {
      store.set(ref.id, data)
    })

    firestoreMocks.runTransaction.mockImplementation(async (_db: unknown, updateFn: (tx: any) => Promise<boolean>) => {
      const tx = {
        get: vi.fn(async (ref: { id: string }) => ({
          exists: () => store.has(ref.id),
        })),
        set: setSpy,
      }
      return updateFn(tx)
    })

    const built = buildOccurrence(sampleSeries, d(2026, 11, 2))

    // 1st call: main doc does not exist -> writes 1 main + 3 subtasks in transaction
    const created1 = await persistOccurrenceTransaction(built)
    expect(created1).toBe(true)
    expect(setSpy).toHaveBeenCalledTimes(4)
    expect(Array.from(store.keys())).toEqual([
      'series_01__2026-11-02',
      'series_01__2026-11-02_st0',
      'series_01__2026-11-02_st1',
      'series_01__2026-11-02_st2',
    ])

    setSpy.mockClear()

    // 2nd call: main doc exists -> tx.set is NOT called at all
    const created2 = await persistOccurrenceTransaction(built)
    expect(created2).toBe(false)
    expect(setSpy).toHaveBeenCalledTimes(0)
    expect(store.size).toBe(4)
  })

  it('createOccurrenceAdmin (server): commits 1 main + N subtasks in a single batch, ignores ALREADY_EXISTS (code 6), and rethrows other errors', async () => {
    const built = buildOccurrence(sampleSeries, d(2026, 11, 2))
    const batchCreateSpy = vi.fn()
    const batchCommitSpy = vi.fn()

    const mockFirestore = {
      collection: vi.fn(() => ({
        doc: vi.fn((id: string) => ({ id })),
      })),
      batch: vi.fn(() => ({
        create: batchCreateSpy,
        commit: batchCommitSpy,
      })),
    } as any

    // 1st call: batch.commit succeeds
    batchCommitSpy.mockResolvedValueOnce(undefined)
    const created1 = await createOccurrenceAdmin(mockFirestore, built)
    expect(created1).toBe(true)
    expect(batchCreateSpy).toHaveBeenCalledTimes(4)
    expect(batchCreateSpy.mock.calls.map(c => c[0].id)).toEqual([
      'series_01__2026-11-02',
      'series_01__2026-11-02_st0',
      'series_01__2026-11-02_st1',
      'series_01__2026-11-02_st2',
    ])

    // 2nd call: batch.commit rejects with ALREADY_EXISTS (code 6) -> returns false without throwing
    const alreadyExistsErr: any = new Error('6 ALREADY_EXISTS: Document already exists')
    alreadyExistsErr.code = 6
    batchCommitSpy.mockRejectedValueOnce(alreadyExistsErr)
    const created2 = await createOccurrenceAdmin(mockFirestore, built)
    expect(created2).toBe(false)

    // 3rd call: unexpected error -> rethrows
    const internalErr: any = new Error('13 INTERNAL')
    internalErr.code = 13
    batchCommitSpy.mockRejectedValueOnce(internalErr)
    await expect(createOccurrenceAdmin(mockFirestore, built)).rejects.toThrow('13 INTERNAL')
  })
})

describe('misfirePolicy & getStartOfTodayInTimezone — timezone-independent tests', () => {
  it('normalizes legacy lowercase values to uppercase', () => {
    expect(normalizeMisfirePolicy('create_missed')).toBe('CREATE_MISSED')
    expect(normalizeMisfirePolicy('skip_missed')).toBe('SKIP_MISSED')
    expect(normalizeMisfirePolicy('CREATE_MISSED')).toBe('CREATE_MISSED')
    expect(normalizeMisfirePolicy('SKIP_MISSED')).toBe('SKIP_MISSED')
    expect(normalizeMisfirePolicy(undefined)).toBe('CREATE_MISSED')
    expect(normalizeMisfirePolicy(null)).toBe('CREATE_MISSED')
  })

  it('getStartOfTodayInTimezone returns exact 00:00 in target timezone independent of host timezone', () => {
    // 2026-11-05 10:30:00 in Asia/Ho_Chi_Minh (+07:00) = 2026-11-05T03:30:00.000Z
    // 00:00 of 2026-11-05 in Asia/Ho_Chi_Minh is 2026-11-04T17:00:00.000Z
    const nowDaytimeVn = new Date('2026-11-05T03:30:00.000Z')
    expect(getStartOfTodayInTimezone(nowDaytimeVn, 'Asia/Ho_Chi_Minh').toISOString()).toBe(
      '2026-11-04T17:00:00.000Z'
    )

    // 2026-11-04T18:00:00.000Z is already 2026-11-05 01:00:00 in Asia/Ho_Chi_Minh (+07:00)
    // Start of today in VN must still be 2026-11-05 00:00:00+07:00 = 2026-11-04T17:00:00.000Z
    const nowEarlyMorningVn = new Date('2026-11-04T18:00:00.000Z')
    expect(getStartOfTodayInTimezone(nowEarlyMorningVn, 'Asia/Ho_Chi_Minh').toISOString()).toBe(
      '2026-11-04T17:00:00.000Z'
    )
  })

  it('SKIP_MISSED includes anchor at 00:00 UTC of today, and excludes 00:00 UTC of yesterday', () => {
    // Today in Asia/Ho_Chi_Minh is 2026-11-05 (starts at 2026-11-04T17:00:00.000Z)
    const now = new Date('2026-11-05T03:30:00.000Z')
    const anchorUtc = new Date('2026-11-01T00:00:00.000Z') // stored as 00:00 UTC

    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      anchorDate: anchorUtc,
      timezone: 'Asia/Ho_Chi_Minh',
    }

    const windowStart = resolveWindowStart({
      lastGeneratedDate: new Date('2026-11-01T00:00:00.000Z'),
      startDate: anchorUtc,
      misfirePolicy: 'skip_missed',
      now,
      timezone: 'Asia/Ho_Chi_Minh',
    })

    expect(windowStart.toISOString()).toBe('2026-11-04T17:00:00.000Z')

    const dates = generateOccurrences(
      rule,
      windowStart,
      new Date('2026-11-07T00:00:00.000Z'),
      { misfirePolicy: 'SKIP_MISSED', now }
    )

    const isoStrings = dates.map(dt => dt.toISOString())
    // Yesterday 00:00 UTC (2026-11-04T00:00:00.000Z) is NOT generated
    expect(isoStrings).not.toContain('2026-11-04T00:00:00.000Z')
    // Today 00:00 UTC (2026-11-05T00:00:00.000Z) IS generated
    expect(isoStrings).toEqual([
      '2026-11-05T00:00:00.000Z',
      '2026-11-06T00:00:00.000Z',
      '2026-11-07T00:00:00.000Z',
    ])
  })

  it('CREATE_MISSED includes past missed occurrences (including yesterday 00:00 UTC)', () => {
    const now = new Date('2026-11-05T03:30:00.000Z')
    const anchorUtc = new Date('2026-11-01T00:00:00.000Z')
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      anchorDate: anchorUtc,
      timezone: 'Asia/Ho_Chi_Minh',
    }

    const windowStart = resolveWindowStart({
      lastGeneratedDate: new Date('2026-11-01T00:00:00.000Z'),
      startDate: anchorUtc,
      misfirePolicy: 'create_missed',
      now,
      timezone: 'Asia/Ho_Chi_Minh',
    })

    const dates = generateOccurrences(
      rule,
      windowStart,
      new Date('2026-11-05T00:00:00.000Z'),
      { misfirePolicy: 'CREATE_MISSED', now }
    )

    expect(dates.map(dt => dt.toISOString())).toEqual([
      '2026-11-02T00:00:00.000Z',
      '2026-11-03T00:00:00.000Z',
      '2026-11-04T00:00:00.000Z',
      '2026-11-05T00:00:00.000Z',
    ])
  })
})

describe('after_completion — deterministic ID, subtask exclusion, and cron catch-up', () => {
  const afterSeries: OccurrenceSeriesInput = {
    ...sampleSeries,
    id: 'series_after',
    recurrenceType: 'after_completion',
    completionOffsetDays: 3,
    startDate: d(2026, 11, 1),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates deterministic ID ${seriesId}_after_${previousTaskId}', () => {
    expect(afterCompletionDocId('series_after', 'task_prev_1')).toBe('series_after_after_task_prev_1')

    const built = buildOccurrence(afterSeries, d(2026, 11, 4), {
      previousTaskId: 'task_prev_1',
    })
    expect(built.taskId).toBe('series_after_after_task_prev_1')
    expect(built.subtasks[0].id).toBe('series_after_after_task_prev_1_st0')
  })

  it('generateNextCompletionOccurrence returns null immediately for subtasks, deleted tasks, or non-occurrence tasks', async () => {
    const baseSubtask: Task = {
      id: 'series_after__2026-11-01_st0',
      seriesId: 'series_after',
      parentTaskId: 'series_after__2026-11-01',
      type: 'single',
      status: 'completed',
      deletedAt: null,
    } as any

    expect(await generateNextCompletionOccurrence(baseSubtask)).toBeNull()
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled()

    const singleTaskWithNullParent: Task = {
      ...baseSubtask,
      parentTaskId: null,
      type: 'single',
    }
    expect(await generateNextCompletionOccurrence(singleTaskWithNullParent)).toBeNull()
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled()

    const deletedOccurrence: Task = {
      ...baseSubtask,
      parentTaskId: null,
      type: 'occurrence',
      deletedAt: new Date() as any,
    }
    expect(await generateNextCompletionOccurrence(deletedOccurrence)).toBeNull()
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled()
  })

  it('planAfterCompletionOccurrence ignores completed subtasks and only considers main occurrences', () => {
    const existing = [
      {
        id: 'series_after__2026-11-01',
        type: 'occurrence',
        status: 'in_progress',
        occurrenceDate: d(2026, 11, 1),
        completedAt: null,
        previousTaskId: null,
        parentTaskId: null,
        deletedAt: null,
      },
      {
        id: 'series_after__2026-11-01_st0',
        type: 'single',
        status: 'completed',
        occurrenceDate: d(2026, 11, 1),
        completedAt: d(2026, 11, 2),
        previousTaskId: null,
        parentTaskId: 'series_after__2026-11-01',
        deletedAt: null,
      },
    ]

    // Subtask is completed, but main occurrence is still in_progress -> must NOT spawn next occurrence
    const planned = planAfterCompletionOccurrence(afterSeries, existing, d(2026, 11, 2))
    expect(planned).toBeNull()
  })

  it('plans initial occurrence when series has no main occurrences yet', () => {
    const planned = planAfterCompletionOccurrence(afterSeries, [], d(2026, 11, 2))
    expect(planned).not.toBeNull()
    expect(planned!.taskId).toBe('series_after__2026-11-01')
    expect(planned!.taskData.previousTaskId).toBeNull()
  })

  it('plans next occurrence when latest main occurrence is completed and has no successor', () => {
    const existing = [
      {
        id: 'series_after__2026-11-01',
        type: 'occurrence',
        status: 'completed',
        occurrenceDate: d(2026, 11, 1),
        completedAt: d(2026, 11, 2),
        previousTaskId: null,
        parentTaskId: null,
      },
    ]

    const planned = planAfterCompletionOccurrence(afterSeries, existing, d(2026, 11, 2))
    expect(planned).not.toBeNull()
    expect(planned!.taskId).toBe('series_after_after_series_after__2026-11-01')
    expect(planned!.taskData.previousTaskId).toBe('series_after__2026-11-01')
    expect(planned!.taskData.occurrenceDate.getDate()).toBe(5)
  })

  it('does not plan duplicate when successor already exists (reopen & complete 2nd time)', () => {
    const existing = [
      {
        id: 'series_after__2026-11-01',
        type: 'occurrence',
        status: 'completed',
        occurrenceDate: d(2026, 11, 1),
        completedAt: d(2026, 11, 3),
        previousTaskId: null,
        parentTaskId: null,
      },
      {
        id: 'series_after_after_series_after__2026-11-01',
        type: 'occurrence',
        status: 'pending',
        occurrenceDate: d(2026, 11, 5),
        completedAt: null,
        previousTaskId: 'series_after__2026-11-01',
        parentTaskId: null,
      },
    ]

    const planned = planAfterCompletionOccurrence(afterSeries, existing, d(2026, 11, 4))
    expect(planned).toBeNull()
  })
})

describe('/api/cron/recurrence — authorization, batch idempotency, and per-series error isolation', () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalSecret
    }
  })

  it('returns 503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const req = new NextRequest('http://localhost:3000/api/cron/recurrence')
    const res = await cronGet(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ error: 'CRON_SECRET not configured' })
  })

  it('returns 401 when Authorization header is missing or invalid, and ignores ?secret=', async () => {
    process.env.CRON_SECRET = 'super_secret_test_token'

    const reqWithQuery = new NextRequest(
      'http://localhost:3000/api/cron/recurrence?secret=super_secret_test_token'
    )
    const resQuery = await cronGet(reqWithQuery)
    expect(resQuery.status).toBe(401)

    const reqWrongBearer = new NextRequest('http://localhost:3000/api/cron/recurrence', {
      headers: { authorization: 'Bearer wrong_token' },
    })
    const resWrong = await cronGet(reqWrongBearer)
    expect(resWrong.status).toBe(401)
  })

  it('cron GET is idempotent across 2 runs via batch.create, ignores completed subtasks, and isolates per-series errors', async () => {
    process.env.CRON_SECRET = 'cron_secret_ok'

    const tasksMap = new Map<string, Record<string, any>>()
    const today = getStartOfTodayInTimezone(new Date(), 'Asia/Ho_Chi_Minh')

    // Pre-populate an after_completion series with 1 completed main task and 1 completed subtask
    tasksMap.set('series_ac__2026-10-01', {
      title: 'Kiểm định thiết bị',
      type: 'occurrence',
      status: 'completed',
      seriesId: 'series_ac',
      occurrenceDate: d(2026, 10, 1),
      completedAt: today,
      previousTaskId: null,
      parentTaskId: null,
      deletedAt: null,
    })
    tasksMap.set('series_ac__2026-10-01_st0', {
      title: 'Việc con đã xong',
      type: 'single',
      status: 'completed',
      seriesId: 'series_ac',
      occurrenceDate: d(2026, 10, 1),
      completedAt: new Date(today.getTime() + 3600000),
      previousTaskId: null,
      parentTaskId: 'series_ac__2026-10-01',
      deletedAt: null,
    })

    const seriesList = [
      {
        id: 'series_broken',
        data: () => {
          throw new Error('Simulated corrupt series document')
        },
        ref: { update: vi.fn() },
      },
      {
        id: 'series_cal',
        data: () => ({
          title: 'Họp giao ban ngày',
          status: 'active',
          recurrenceType: 'calendar',
          frequency: 'daily',
          interval: 1,
          anchorDate: today,
          startDate: today,
          endDate: today,
          rollingWindowDays: 1,
          misfirePolicy: 'SKIP_MISSED',
          timezone: 'Asia/Ho_Chi_Minh',
          defaultSubtasks: [
            { order: 1, title: 'Bước 1', description: null, defaultAssigneeRole: null, estimatedMinutes: 5 },
            { order: 2, title: 'Bước 2', description: null, defaultAssigneeRole: null, estimatedMinutes: 5 },
          ],
        }),
        ref: { update: vi.fn().mockResolvedValue(undefined) },
      },
      {
        id: 'series_ac',
        data: () => ({
          title: 'Kiểm định thiết bị',
          status: 'active',
          recurrenceType: 'after_completion',
          completionOffsetDays: 2,
          frequency: 'daily',
          interval: 1,
          anchorDate: d(2026, 10, 1),
          startDate: d(2026, 10, 1),
          endDate: null,
          rollingWindowDays: 14,
          misfirePolicy: 'CREATE_MISSED',
          timezone: 'Asia/Ho_Chi_Minh',
          defaultSubtasks: [
            { order: 1, title: 'Sub AC 1', description: null, defaultAssigneeRole: null, estimatedMinutes: 10 },
          ],
        }),
        ref: { update: vi.fn().mockResolvedValue(undefined) },
      },
    ]

    const mockFirestore = {
      collection: (colName: string) => {
        if (colName === 'taskSeries') {
          return {
            where: () => ({
              get: async () => ({
                empty: false,
                size: seriesList.length,
                docs: seriesList,
              }),
            }),
          }
        }
        if (colName === 'tasks') {
          return {
            where: (_field: string, _op: string, seriesId: string) => ({
              get: async () => {
                const matching = Array.from(tasksMap.entries())
                  .filter(([, val]) => val.seriesId === seriesId)
                  .map(([id, val]) => ({ id, data: () => val }))
                return { empty: matching.length === 0, docs: matching }
              },
            }),
            doc: (docId: string) => ({ id: docId }),
          }
        }
        throw new Error(`Unexpected collection ${colName}`)
      },
      batch: () => {
        const ops: Array<{ id: string; data: Record<string, any> }> = []
        return {
          create: (ref: { id: string }, data: Record<string, any>) => {
            ops.push({ id: ref.id, data })
          },
          commit: async () => {
            for (const op of ops) {
              if (tasksMap.has(op.id)) {
                const err: any = new Error('6 ALREADY_EXISTS: Document already exists')
                err.code = 6
                throw err
              }
            }
            for (const op of ops) {
              tasksMap.set(op.id, op.data)
            }
          },
        }
      },
    }

    vi.mocked(getAdminFirestore).mockReturnValue(mockFirestore as any)

    const makeReq = () =>
      new NextRequest('http://localhost:3000/api/cron/recurrence', {
        headers: { authorization: 'Bearer cron_secret_ok' },
      })

    // First cron run: series_broken fails in errors[], series_cal + series_ac succeed
    const res1 = await cronGet(makeReq())
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.generatedTasks).toBe(2)
    expect(body1.errors).toEqual([
      { seriesId: 'series_broken', message: 'Simulated corrupt series document' },
    ])

    // Verify after_completion spawned from main task, NOT from subtask
    expect(tasksMap.has('series_ac_after_series_ac__2026-10-01')).toBe(true)
    expect(tasksMap.has('series_ac_after_series_ac__2026-10-01_st0')).toBe(true)
    expect(tasksMap.has('series_ac_after_series_ac__2026-10-01_st0_st0')).toBe(false)

    const countAfterFirstRun = tasksMap.size

    // Second cron run with identical state -> 0 new tasks, no duplicate subtasks
    const res2 = await cronGet(makeReq())
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.generatedTasks).toBe(0)
    expect(tasksMap.size).toBe(countAfterFirstRun)
  })
})
