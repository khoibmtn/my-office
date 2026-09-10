import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { generateOccurrences, occurrenceDocId, applyWeekendPolicy } from '@/lib/recurrence/generate'
import type { RecurrenceRule } from '@/lib/recurrence/types'
import type { TaskSeries, Task } from '@/types/tasks'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // 1. Verify authorization if CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = req.headers.get('authorization')
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
      const querySecret = req.nextUrl.searchParams.get('secret')

      if (bearerToken !== cronSecret && querySecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
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
        message: 'No active task series found',
      })
    }

    const now = new Date()
    let totalGenerated = 0

    for (const docSnap of seriesSnap.docs) {
      const series = { id: docSnap.id, ...docSnap.data() } as TaskSeries
      const rollingDays = series.rollingWindowDays || 14
      let windowEnd = new Date(now.getTime() + rollingDays * 86400000)

      // Handle after_completion series
      if (series.recurrenceType === 'after_completion') {
        const existingCheck = await firestore
          .collection('tasks')
          .where('seriesId', '==', series.id)
          .limit(1)
          .get()

        if (existingCheck.empty) {
          const start = series.startDate instanceof Timestamp
            ? series.startDate.toDate()
            : new Date(series.startDate as any)
          let occDate = new Date(start)
          if (series.weekendPolicy && series.weekendPolicy !== 'exact') {
            occDate = applyWeekendPolicy(occDate, series.weekendPolicy)
          }

          const docId = occurrenceDocId(series.id, occDate)
          const taskRef = firestore.collection('tasks').doc(docId)
          const batch = firestore.batch()

          const leadMs = (series.leadDays || 0) * 86400000
          const dueOffsetMs = (series.dueOffsetMinutes || 0) * 60000
          const occKey = `${series.id}:${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, '0')}-${String(occDate.getDate()).padStart(2, '0')}`

          batch.set(taskRef, {
            taskCode: null,
            title: series.title,
            description: series.description || '',
            type: 'occurrence',
            status: 'pending',
            priority: series.defaultPriority || 'normal',
            progress: 0,
            progressMode: 'manual',
            isClosed: false,
            startDate: null,
            dueDate: Timestamp.fromDate(new Date(occDate.getTime() + dueOffsetMs)),
            completedAt: null,
            estimatedMinutes: series.defaultEstimatedMinutes || null,
            occurrenceDate: Timestamp.fromDate(occDate),
            visibleFrom: leadMs > 0 ? Timestamp.fromDate(new Date(occDate.getTime() - leadMs)) : null,
            createdBy: series.createdBy,
            assigneeId: series.defaultAssigneeId || null,
            assigneeName: null,
            collaboratorIds: series.defaultCollaboratorIds || [],
            followerIds: series.defaultFollowerIds || [],
            departmentId: series.defaultDepartmentId || null,
            cooperatingDepartmentIds: [],
            assigneeDepartmentId: series.defaultDepartmentId || null,
            blockedReason: null,
            blockedByTaskIds: [],
            blockedNote: null,
            previousStatus: null,
            dossierIds: series.defaultDossierIds || [],
            documentIds: series.defaultDocumentIds || [],
            parentTaskId: null,
            dependsOnTaskIds: [],
            relatedTaskIds: [],
            seriesId: series.id,
            occurrenceKey: occKey,
            templateId: series.templateId || null,
            tagIds: series.defaultTagIds || [],
            attachments: [],
            source: 'recurring',
            previousTaskId: null,
            isDetached: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            deletedAt: null,
            migratedFromChecklistId: null,
          })

          if (series.defaultSubtasks && Array.isArray(series.defaultSubtasks)) {
            for (const st of series.defaultSubtasks) {
              const subRef = firestore.collection('tasks').doc()
              batch.set(subRef, {
                taskCode: null,
                title: st.title,
                description: st.description || null,
                type: 'single',
                status: 'pending',
                priority: series.defaultPriority || 'normal',
                progress: 0,
                progressMode: 'manual',
                isClosed: false,
                startDate: null,
                dueDate: Timestamp.fromDate(new Date(occDate.getTime() + dueOffsetMs)),
                completedAt: null,
                estimatedMinutes: st.estimatedMinutes || null,
                occurrenceDate: Timestamp.fromDate(occDate),
                visibleFrom: null,
                createdBy: series.createdBy,
                assigneeId: series.defaultAssigneeId || null,
                assigneeName: null,
                collaboratorIds: [],
                followerIds: [],
                departmentId: series.defaultDepartmentId || null,
                cooperatingDepartmentIds: [],
                assigneeDepartmentId: series.defaultDepartmentId || null,
                blockedReason: null,
                blockedByTaskIds: [],
                blockedNote: null,
                previousStatus: null,
                dossierIds: series.defaultDossierIds || [],
                documentIds: series.defaultDocumentIds || [],
                parentTaskId: docId,
                dependsOnTaskIds: [],
                relatedTaskIds: [],
                seriesId: series.id,
                occurrenceKey: `${occKey}:subtask:${st.order}`,
                templateId: null,
                tagIds: series.defaultTagIds || [],
                attachments: [],
                source: 'recurring',
                previousTaskId: null,
                isDetached: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                deletedAt: null,
                migratedFromChecklistId: null,
              })
            }
          }

          await batch.commit()
          await docSnap.ref.update({
            lastGeneratedDate: Timestamp.fromDate(occDate),
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
        anchorDate: series.anchorDate instanceof Timestamp
          ? series.anchorDate.toDate()
          : new Date(series.anchorDate as any),
        timezone: series.timezone || 'Asia/Ho_Chi_Minh',
      }

      let windowStart: Date
      if (series.lastGeneratedDate) {
        const last = series.lastGeneratedDate instanceof Timestamp
          ? series.lastGeneratedDate.toDate()
          : new Date(series.lastGeneratedDate as any)
        windowStart = new Date(last.getTime() + 86400000)
      } else if (series.startDate) {
        windowStart = series.startDate instanceof Timestamp
          ? series.startDate.toDate()
          : new Date(series.startDate as any)
      } else {
        windowStart = new Date()
      }

      if (series.endDate) {
        const end = series.endDate instanceof Timestamp
          ? series.endDate.toDate()
          : new Date(series.endDate as any)
        if (windowStart > end) continue
        if (windowEnd > end) windowEnd = end
      }

      const occurrenceDates = generateOccurrences(rule, windowStart, windowEnd)
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
          const od = data.occurrenceDate instanceof Timestamp
            ? data.occurrenceDate.toDate()
            : (data.occurrenceDate ? new Date(data.occurrenceDate) : null)
          if (!od) return null
          return { id: d.id, occurrenceDate: od }
        })
        .filter((t): t is { id: string; occurrenceDate: Date } => t !== null)
        .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())

      let seriesCreated = 0

      for (let i = 0; i < occurrenceDates.length; i += 25) {
        const batch = firestore.batch()
        const chunk = occurrenceDates.slice(i, i + 25)

        for (const occDate of chunk) {
          const docId = occurrenceDocId(series.id, occDate)
          const taskRef = firestore.collection('tasks').doc(docId)
          const existing = await taskRef.get()
          if (existing.exists) continue

          const occTime = occDate.getTime()
          let prevId: string | null = null
          for (let j = existingTasks.length - 1; j >= 0; j--) {
            if (existingTasks[j].occurrenceDate.getTime() < occTime) {
              prevId = existingTasks[j].id
              break
            }
          }

          const leadMs = (series.leadDays || 0) * 86400000
          const dueOffsetMs = (series.dueOffsetMinutes || 0) * 60000
          const occKey = `${series.id}:${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, '0')}-${String(occDate.getDate()).padStart(2, '0')}`

          batch.set(taskRef, {
            taskCode: null,
            title: series.title,
            description: series.description || '',
            type: 'occurrence',
            status: 'pending',
            priority: series.defaultPriority || 'normal',
            progress: 0,
            progressMode: 'manual',
            isClosed: false,
            startDate: null,
            dueDate: Timestamp.fromDate(new Date(occDate.getTime() + dueOffsetMs)),
            completedAt: null,
            estimatedMinutes: series.defaultEstimatedMinutes || null,
            occurrenceDate: Timestamp.fromDate(occDate),
            visibleFrom: leadMs > 0 ? Timestamp.fromDate(new Date(occDate.getTime() - leadMs)) : null,
            createdBy: series.createdBy,
            assigneeId: series.defaultAssigneeId || null,
            assigneeName: null,
            collaboratorIds: series.defaultCollaboratorIds || [],
            followerIds: series.defaultFollowerIds || [],
            departmentId: series.defaultDepartmentId || null,
            cooperatingDepartmentIds: [],
            assigneeDepartmentId: series.defaultDepartmentId || null,
            blockedReason: null,
            blockedByTaskIds: [],
            blockedNote: null,
            previousStatus: null,
            dossierIds: series.defaultDossierIds || [],
            documentIds: series.defaultDocumentIds || [],
            parentTaskId: null,
            dependsOnTaskIds: [],
            relatedTaskIds: [],
            seriesId: series.id,
            occurrenceKey: occKey,
            templateId: series.templateId || null,
            tagIds: series.defaultTagIds || [],
            attachments: [],
            source: 'recurring',
            previousTaskId: prevId,
            isDetached: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            deletedAt: null,
            migratedFromChecklistId: null,
          })

          if (series.defaultSubtasks && Array.isArray(series.defaultSubtasks)) {
            for (const st of series.defaultSubtasks) {
              const subRef = firestore.collection('tasks').doc()
              batch.set(subRef, {
                taskCode: null,
                title: st.title,
                description: st.description || null,
                type: 'single',
                status: 'pending',
                priority: series.defaultPriority || 'normal',
                progress: 0,
                progressMode: 'manual',
                isClosed: false,
                startDate: null,
                dueDate: Timestamp.fromDate(new Date(occDate.getTime() + dueOffsetMs)),
                completedAt: null,
                estimatedMinutes: st.estimatedMinutes || null,
                occurrenceDate: Timestamp.fromDate(occDate),
                visibleFrom: null,
                createdBy: series.createdBy,
                assigneeId: series.defaultAssigneeId || null,
                assigneeName: null,
                collaboratorIds: [],
                followerIds: [],
                departmentId: series.defaultDepartmentId || null,
                cooperatingDepartmentIds: [],
                assigneeDepartmentId: series.defaultDepartmentId || null,
                blockedReason: null,
                blockedByTaskIds: [],
                blockedNote: null,
                previousStatus: null,
                dossierIds: series.defaultDossierIds || [],
                documentIds: series.defaultDocumentIds || [],
                parentTaskId: docId,
                dependsOnTaskIds: [],
                relatedTaskIds: [],
                seriesId: series.id,
                occurrenceKey: `${occKey}:subtask:${st.order}`,
                templateId: null,
                tagIds: series.defaultTagIds || [],
                attachments: [],
                source: 'recurring',
                previousTaskId: null,
                isDetached: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                deletedAt: null,
                migratedFromChecklistId: null,
              })
            }
          }

          existingTasks.push({ id: docId, occurrenceDate: occDate })
          existingTasks.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime())
          seriesCreated++
        }

        await batch.commit()
      }

      if (seriesCreated > 0) {
        const lastDate = occurrenceDates[occurrenceDates.length - 1]
        await docSnap.ref.update({
          lastGeneratedDate: Timestamp.fromDate(lastDate),
          updatedAt: FieldValue.serverTimestamp(),
        })
        totalGenerated += seriesCreated
      }
    }

    return NextResponse.json({
      success: true,
      processedSeries: seriesSnap.size,
      generatedTasks: totalGenerated,
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
