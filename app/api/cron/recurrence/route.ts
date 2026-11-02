import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { generateOccurrences } from '@/lib/recurrence/generate'
import {
  buildOccurrence,
  planAfterCompletionOccurrence,
  resolveWindowStart,
  toPlainDate,
  type BuiltOccurrence,
  type PlainOccurrenceTaskData,
} from '@/lib/recurrence/buildOccurrence'
import type { RecurrenceRule } from '@/lib/recurrence/types'
import type { TaskSeries } from '@/types/tasks'

export const dynamic = 'force-dynamic'

function isAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown; details?: unknown }
  if (e.code === 6 || e.code === '6' || e.code === 'ALREADY_EXISTS') return true
  if (typeof e.message === 'string' && e.message.includes('ALREADY_EXISTS')) return true
  if (typeof e.details === 'string' && e.details.includes('ALREADY_EXISTS')) return true
  return false
}

function toAdminTaskData(data: PlainOccurrenceTaskData) {
  return {
    ...data,
    startDate: data.startDate ? Timestamp.fromDate(data.startDate) : null,
    dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
    completedAt: data.completedAt ? Timestamp.fromDate(data.completedAt) : null,
    occurrenceDate: data.occurrenceDate ? Timestamp.fromDate(data.occurrenceDate) : null,
    visibleFrom: data.visibleFrom ? Timestamp.fromDate(data.visibleFrom) : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    deletedAt: null,
  }
}

/**
 * Atomically and idempotently create a built occurrence and its deterministic subtasks
 * using a single Admin SDK WriteBatch (`batch.create(main)` + `batch.create(subtask_i)`).
 * If commit() fails with ALREADY_EXISTS (gRPC code 6), treats as already existing and returns false.
 */
async function createOccurrenceAdmin(
  firestore: FirebaseFirestore.Firestore,
  built: BuiltOccurrence
): Promise<boolean> {
  const batch = firestore.batch()
  const taskRef = firestore.collection('tasks').doc(built.taskId)
  batch.create(taskRef, toAdminTaskData(built.taskData))

  for (const st of built.subtasks) {
    const subRef = firestore.collection('tasks').doc(st.id)
    batch.create(subRef, toAdminTaskData(st.data))
  }

  try {
    await batch.commit()
    return true
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      return false
    }
    throw err
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Require CRON_SECRET and strict Authorization: Bearer header
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
    }

    const authHeader = req.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!bearerToken || bearerToken !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const firestore = getAdminFirestore()
    const seriesSnap = await firestore
      .collection('taskSeries')
      .where('status', '==', 'active')
      .get()

    if (seriesSnap.empty) {
      return NextResponse.json({
        success: true,
        processedSeries: 0,
        generatedTasks: 0,
        errors: [],
        message: 'No active task series found',
      })
    }

    const now = new Date()
    let totalGenerated = 0
    const errors: Array<{ seriesId: string; message: string }> = []

    for (const docSnap of seriesSnap.docs) {
      const seriesId = docSnap.id
      try {
        const series = { id: seriesId, ...docSnap.data() } as TaskSeries
        const rollingDays = series.rollingWindowDays || 14
        let windowEnd = new Date(now.getTime() + rollingDays * 86400000)

        // Handle after_completion series (only consider main occurrences: parentTaskId == null, not deleted, type === 'occurrence')
        if (series.recurrenceType === 'after_completion') {
          const existingSnap = await firestore
            .collection('tasks')
            .where('seriesId', '==', series.id)
            .get()

          const summaries = existingSnap.docs
            .map(d => {
              const data = d.data()
              return {
                id: d.id,
                type: data.type,
                status: data.status,
                occurrenceDate: data.occurrenceDate,
                completedAt: data.completedAt,
                previousTaskId: data.previousTaskId,
                parentTaskId: data.parentTaskId ?? null,
                deletedAt: data.deletedAt ?? null,
              }
            })
            .filter(t => t.parentTaskId === null && !t.deletedAt && (!t.type || t.type === 'occurrence'))

          const planned = planAfterCompletionOccurrence(series, summaries, now)
          if (!planned) continue

          const created = await createOccurrenceAdmin(firestore, planned)
          if (created) {
            await docSnap.ref.update({
              lastGeneratedDate: Timestamp.fromDate(planned.taskData.occurrenceDate),
              updatedAt: FieldValue.serverTimestamp(),
            })
            totalGenerated++
          }
          continue
        }

        // Calendar-based recurrence
        const rule: RecurrenceRule = {
          frequency: series.frequency,
          interval: series.interval,
          byWeekday: series.byWeekday ? series.byWeekday : undefined,
          byMonthDay: series.byMonthDay ? series.byMonthDay : undefined,
          byMonth: series.byMonth ? series.byMonth : undefined,
          bySetPos: series.bySetPos !== null && series.bySetPos !== undefined ? series.bySetPos : undefined,
          weekendPolicy: series.weekendPolicy || 'exact',
          anchorDate: toPlainDate(series.anchorDate) ?? now,
          timezone: series.timezone || 'Asia/Ho_Chi_Minh',
        }

        const windowStart = resolveWindowStart({
          lastGeneratedDate: toPlainDate(series.lastGeneratedDate),
          startDate: toPlainDate(series.startDate),
          misfirePolicy: series.misfirePolicy,
          now,
          timezone: series.timezone || 'Asia/Ho_Chi_Minh',
        })

        if (series.endDate) {
          const end = toPlainDate(series.endDate)
          if (end) {
            if (windowStart > end) continue
            if (windowEnd > end) windowEnd = end
          }
        }

        const occurrenceDates = generateOccurrences(rule, windowStart, windowEnd, {
          misfirePolicy: series.misfirePolicy,
          now,
        })
        if (occurrenceDates.length === 0) continue

        // Query existing tasks to link previousTaskId
        const existingSnap = await firestore
          .collection('tasks')
          .where('seriesId', '==', series.id)
          .get()

        const existingTasks: { id: string; occurrenceDate: Date }[] = existingSnap.docs
          .map(d => {
            const data = d.data()
            if (data.parentTaskId) return null
            const od = toPlainDate(data.occurrenceDate)
            if (!od) return null
            return { id: d.id, occurrenceDate: od }
          })
          .filter((t): t is { id: string; occurrenceDate: Date } => t !== null)
          .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())

        let seriesCreated = 0

        for (const occDate of occurrenceDates) {
          const occTime = occDate.getTime()
          let prevId: string | null = null
          for (let j = existingTasks.length - 1; j >= 0; j--) {
            if (existingTasks[j].occurrenceDate.getTime() < occTime) {
              prevId = existingTasks[j].id
              break
            }
          }

          const built = buildOccurrence(series, occDate, { previousTaskId: prevId })
          const created = await createOccurrenceAdmin(firestore, built)
          if (!created) continue

          existingTasks.push({ id: built.taskId, occurrenceDate: occDate })
          existingTasks.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())
          seriesCreated++
        }

        if (seriesCreated > 0) {
          const lastDate = occurrenceDates[occurrenceDates.length - 1]
          await docSnap.ref.update({
            lastGeneratedDate: Timestamp.fromDate(lastDate),
            updatedAt: FieldValue.serverTimestamp(),
          })
          totalGenerated += seriesCreated
        }
      } catch (seriesErr: any) {
        console.error(`[/api/cron/recurrence] Error processing series ${seriesId}:`, seriesErr)
        errors.push({
          seriesId,
          message: seriesErr?.message || String(seriesErr),
        })
      }
    }

    return NextResponse.json({
      success: true,
      processedSeries: seriesSnap.size,
      generatedTasks: totalGenerated,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[/api/cron/recurrence] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
