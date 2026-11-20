'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useWeeklyReport } from '@/hooks/useWeeklyReport'
import { useWeeks } from '@/hooks/useWeeks'
import { useRouter } from 'next/navigation'
import { useWeeklyReportConfig } from '@/hooks/useWeeklyReportConfig'
import {
  finalizeWeek,
  reopenWeek,
  updateSection,
  updateWeekMeta,
  updateWorkItems,
} from '@/lib/weekly-report/firestore'
import { newId } from '@/lib/weekly-report/outline'
import { PrevNextWeekImport } from '@/components/weekly-report/PrevNextWeekImport'
import { currentWeekId, dayOfWeek, todayVN } from '@/lib/weekly-report/period'
import { WeekHeader, type SaveIndicatorStatus } from '@/components/weekly-report/WeekHeader'
import { WorkItemOutliner } from '@/components/weekly-report/WorkItemOutliner'
import { AdvisoryList } from '@/components/weekly-report/AdvisoryList'
import { TaskSuggestions } from '@/components/weekly-report/TaskSuggestions'
import { RichEditor } from '@/components/weekly-report/RichEditor'
import { WeeklyStatsPanel } from '@/components/weekly-report/WeeklyStatsPanel'
import { FinalizeBar } from '@/components/weekly-report/FinalizeBar'
import { PeriodEditDialog, type WeekMetaPatch } from '@/components/weekly-report/PeriodEditDialog'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import {
  RICH_SECTION_LABELS,
  type ISODate,
  type RichSectionKey,
  type WorkItem,
} from '@/types/weekly-report'

const DEBOUNCE_MS = 1500
const EMPTY_RICH_DOC_JSON = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })

function isValidIsoDate(value: string): value is ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d &&
    // weekId luôn là ngày Thứ 6 giao ban (tránh tạo bản ghi tuần rác)
    dayOfWeek(value) === 5
  )
}

interface PendingRichPayload {
  docJson: string
  plainText: string
}

function WeeklyReportWorkspace({ weekId }: { weekId: string }) {
  const { report, loading, error, carriedCount } = useWeeklyReport(weekId)
  const { weeks } = useWeeks()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'content' | 'stats'>('content')
  const { config } = useWeeklyReportConfig()

  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [sectionsState, setSectionsState] = useState<{
    opinions: { docJson: string; plainText: string } | null
    nextWeek: { docJson: string; plainText: string } | null
    proposedSchedule: { docJson: string; plainText: string } | null
    deputyOpinions: { docJson: string; plainText: string } | null
  }>({
    opinions: null,
    nextWeek: null,
    proposedSchedule: null,
    deputyOpinions: null,
  })

  const [saveStatus, setSaveStatus] = useState<SaveIndicatorStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [confirmRemoveSection, setConfirmRemoveSection] = useState<RichSectionKey | null>(null)
  const [removingSection, setRemovingSection] = useState(false)
  const [carriedToastCount, setCarriedToastCount] = useState<number>(0)
  const [hasPendingDirty, setHasPendingDirty] = useState(false)

  const initializedWeekRef = useRef<string | null>(null)
  // Rich editors must only mount after the week's sections are loaded into state,
  // otherwise they start empty and any spurious update could persist an empty doc.
  const [hydratedWeekId, setHydratedWeekId] = useState<string | null>(null)
  const dirtyWorkItemsRef = useRef(false)
  const pendingWorkItemsRef = useRef<WorkItem[] | null>(null)
  const workItemsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirtySectionsRef = useRef<Partial<Record<RichSectionKey, boolean>>>({})
  const pendingSectionsRef = useRef<Partial<Record<RichSectionKey, PendingRichPayload>>>({})
  const sectionTimersRef = useRef<Partial<Record<RichSectionKey, ReturnType<typeof setTimeout>>>>({})
  const activeSaveCountRef = useRef(0)

  const recomputePendingFlag = useCallback(() => {
    const hasSectionPending = (Object.keys(dirtySectionsRef.current) as RichSectionKey[]).some(
      (k) => Boolean(dirtySectionsRef.current[k]),
    )
    setHasPendingDirty(
      dirtyWorkItemsRef.current || hasSectionPending || activeSaveCountRef.current > 0,
    )
  }, [])

  // Flush pending debounced edits for the OLD week when switching week / unmounting,
  // otherwise edits made in the last ~1.5s would be silently dropped.
  useEffect(() => {
    const wid = weekId
    return () => {
      if (workItemsTimerRef.current) clearTimeout(workItemsTimerRef.current)
      if (dirtyWorkItemsRef.current && pendingWorkItemsRef.current) {
        void updateWorkItems(wid, pendingWorkItemsRef.current).catch(() => {})
      }
      ;(Object.keys(pendingSectionsRef.current) as RichSectionKey[]).forEach((k) => {
        const t = sectionTimersRef.current[k]
        if (t) clearTimeout(t)
        const pending = pendingSectionsRef.current[k]
        if (dirtySectionsRef.current[k] && pending) {
          void updateSection(wid, k, pending).catch(() => {})
        }
      })
    }
  }, [weekId])

  // Reset local editor buffers when switching weekId
  useEffect(() => {
    initializedWeekRef.current = null
    dirtyWorkItemsRef.current = false
    pendingWorkItemsRef.current = null
    if (workItemsTimerRef.current) clearTimeout(workItemsTimerRef.current)
    dirtySectionsRef.current = {}
    pendingSectionsRef.current = {}
    ;(Object.keys(sectionTimersRef.current) as RichSectionKey[]).forEach((k) => {
      const t = sectionTimersRef.current[k]
      if (t) clearTimeout(t)
    })
    sectionTimersRef.current = {}
    setSaveStatus('idle')
    setSaveErrorMessage(null)
    setCarriedToastCount(0)
    setHasPendingDirty(false)
  }, [weekId])

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (workItemsTimerRef.current) clearTimeout(workItemsTimerRef.current)
      ;(Object.keys(sectionTimersRef.current) as RichSectionKey[]).forEach((k) => {
        const t = sectionTimersRef.current[k]
        if (t) clearTimeout(t)
      })
    }
  }, [])

  // Hydrate from Firestore snapshot (respecting dirty fields to avoid overwriting active typing)
  useEffect(() => {
    if (!report) return
    const firstForWeek = initializedWeekRef.current !== report.id
    if (firstForWeek) {
      initializedWeekRef.current = report.id
      setWorkItems(report.workItems)
      setSectionsState({
        opinions: report.sections.opinions
          ? { docJson: report.sections.opinions.docJson, plainText: report.sections.opinions.plainText }
          : null,
        nextWeek: report.sections.nextWeek
          ? { docJson: report.sections.nextWeek.docJson, plainText: report.sections.nextWeek.plainText }
          : null,
        proposedSchedule: report.sections.proposedSchedule
          ? {
              docJson: report.sections.proposedSchedule.docJson,
              plainText: report.sections.proposedSchedule.plainText,
            }
          : null,
        deputyOpinions: report.sections.deputyOpinions
          ? {
              docJson: report.sections.deputyOpinions.docJson,
              plainText: report.sections.deputyOpinions.plainText,
            }
          : null,
      })
      setHydratedWeekId(report.id)
      return
    }

    if (!dirtyWorkItemsRef.current) {
      setWorkItems(report.workItems)
    }

    const keys: RichSectionKey[] = ['opinions', 'nextWeek', 'proposedSchedule', 'deputyOpinions']
    setSectionsState((prev) => {
      let changed = false
      const next = { ...prev }
      for (const key of keys) {
        if (dirtySectionsRef.current[key]) continue
        const incoming = report.sections[key]
        const mapped = incoming ? { docJson: incoming.docJson, plainText: incoming.plainText } : null
        if (
          prev[key]?.docJson !== mapped?.docJson ||
          prev[key]?.plainText !== mapped?.plainText
        ) {
          next[key] = mapped
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [report])

  // Show one-time carried pinned items toast
  useEffect(() => {
    if (carriedCount > 0) {
      setCarriedToastCount(carriedCount)
    }
  }, [carriedCount])

  // Warn before leaving while there are unsaved changes or failed saves
  useEffect(() => {
    const shouldWarn = hasPendingDirty || saveStatus === 'saving' || saveStatus === 'error'
    if (!shouldWarn) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasPendingDirty, saveStatus])

  const persistWorkItems = useCallback(
    async (itemsToSave: WorkItem[]) => {
      activeSaveCountRef.current += 1
      setSaveStatus('saving')
      setSaveErrorMessage(null)
      recomputePendingFlag()
      try {
        await updateWorkItems(weekId, itemsToSave)
        // Clear dirty only if no newer edit happened while saving
        if (pendingWorkItemsRef.current === itemsToSave) {
          dirtyWorkItemsRef.current = false
          pendingWorkItemsRef.current = null
        }
        if (activeSaveCountRef.current <= 1 && !dirtyWorkItemsRef.current) {
          setSaveStatus('saved')
          setLastSavedAt(new Date())
        }
      } catch (err) {
        setSaveStatus('error')
        setSaveErrorMessage(err instanceof Error ? err.message : 'Lỗi lưu mục công việc')
      } finally {
        activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1)
        recomputePendingFlag()
      }
    },
    [weekId, recomputePendingFlag],
  )

  const persistSection = useCallback(
    async (key: RichSectionKey, payload: PendingRichPayload) => {
      activeSaveCountRef.current += 1
      setSaveStatus('saving')
      setSaveErrorMessage(null)
      recomputePendingFlag()
      try {
        await updateSection(weekId, key, payload)
        if (pendingSectionsRef.current[key] === payload) {
          dirtySectionsRef.current[key] = false
          delete pendingSectionsRef.current[key]
        }
        const stillDirty =
          dirtyWorkItemsRef.current ||
          (Object.keys(dirtySectionsRef.current) as RichSectionKey[]).some((k) =>
            Boolean(dirtySectionsRef.current[k]),
          )
        if (activeSaveCountRef.current <= 1 && !stillDirty) {
          setSaveStatus('saved')
          setLastSavedAt(new Date())
        }
      } catch (err) {
        setSaveStatus('error')
        setSaveErrorMessage(err instanceof Error ? err.message : 'Lỗi lưu nội dung')
      } finally {
        activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1)
        recomputePendingFlag()
      }
    },
    [weekId, recomputePendingFlag],
  )

  const handleWorkItemsChange = useCallback(
    (nextItems: WorkItem[]) => {
      setWorkItems(nextItems)
      dirtyWorkItemsRef.current = true
      pendingWorkItemsRef.current = nextItems
      setSaveStatus('saving')
      recomputePendingFlag()

      if (workItemsTimerRef.current) clearTimeout(workItemsTimerRef.current)
      workItemsTimerRef.current = setTimeout(() => {
        const snapshot = pendingWorkItemsRef.current
        if (snapshot) void persistWorkItems(snapshot)
      }, DEBOUNCE_MS)
    },
    [persistWorkItems, recomputePendingFlag],
  )

  const handleSectionChange = useCallback(
    (key: RichSectionKey, docJson: string, plainText: string) => {
      const payload: PendingRichPayload = { docJson, plainText }
      setSectionsState((prev) => ({ ...prev, [key]: payload }))
      dirtySectionsRef.current[key] = true
      pendingSectionsRef.current[key] = payload
      setSaveStatus('saving')
      recomputePendingFlag()

      const existingTimer = sectionTimersRef.current[key]
      if (existingTimer) clearTimeout(existingTimer)
      sectionTimersRef.current[key] = setTimeout(() => {
        const snapshot = pendingSectionsRef.current[key]
        if (snapshot) void persistSection(key, snapshot)
      }, DEBOUNCE_MS)
    },
    [persistSection, recomputePendingFlag],
  )

  const flushAllPendingSaves = useCallback(async () => {
    const tasks: Promise<void>[] = []
    if (workItemsTimerRef.current) {
      clearTimeout(workItemsTimerRef.current)
      workItemsTimerRef.current = null
    }
    if (dirtyWorkItemsRef.current && pendingWorkItemsRef.current) {
      tasks.push(persistWorkItems(pendingWorkItemsRef.current))
    }

    const keys: RichSectionKey[] = ['opinions', 'nextWeek', 'proposedSchedule', 'deputyOpinions']
    for (const k of keys) {
      const t = sectionTimersRef.current[k]
      if (t) {
        clearTimeout(t)
        delete sectionTimersRef.current[k]
      }
      const pending = pendingSectionsRef.current[k]
      if (dirtySectionsRef.current[k] && pending) {
        tasks.push(persistSection(k, pending))
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks)
    }
    return tasks.length
  }, [persistWorkItems, persistSection])

  // Manual save (button / Ctrl+S) — autosave stays on
  const handleSaveNow = useCallback(async () => {
    const n = await flushAllPendingSaves()
    if (n === 0) {
      setSaveStatus('saved')
      setLastSavedAt(new Date())
    }
  }, [flushAllPendingSaves])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSaveNow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSaveNow])

  const handleAddTaskSuggestions = useCallback(
    (tasks: Array<{ id: string; title: string }>) => {
      const fresh = tasks.filter((t) => !workItems.some((item) => item.taskId === t.id))
      if (!fresh.length) return
      const added: WorkItem[] = fresh.map((task, i) => ({
        id: newId(),
        text: task.title,
        highlight: false,
        pinned: false,
        order: workItems.length + i,
        source: 'task',
        taskId: task.id,
        children: [],
      }))
      handleWorkItemsChange([...workItems, ...added])
    },
    [workItems, handleWorkItemsChange],
  )
  // Previous stored week — its "3. Tuần tới" can be pulled into Mục 1
  const prevWeek = useMemo(
    () => weeks.filter((w) => w.id < weekId).sort((a, b) => (a.id < b.id ? 1 : -1))[0] ?? null,
    [weeks, weekId],
  )

  const handleAddTaskSuggestion = useCallback(
    (task: { id: string; title: string }) => handleAddTaskSuggestions([task]),
    [handleAddTaskSuggestions],
  )

  const handleUndoCarried = () => {
    const filtered = workItems
      .filter((item) => item.source !== 'carried')
      .map((item, idx) => ({ ...item, order: idx }))
    setCarriedToastCount(0)
    handleWorkItemsChange(filtered)
  }

  const handleEnableOptionalSection = async (key: 'proposedSchedule' | 'deputyOpinions') => {
    const payload = { docJson: EMPTY_RICH_DOC_JSON, plainText: '' }
    setSectionsState((prev) => ({ ...prev, [key]: payload }))
    await persistSection(key, payload)
  }

  const handleConfirmRemoveOptionalSection = async () => {
    if (!confirmRemoveSection) return
    setRemovingSection(true)
    const key = confirmRemoveSection
    try {
      const timer = sectionTimersRef.current[key]
      if (timer) {
        clearTimeout(timer)
        delete sectionTimersRef.current[key]
      }
      dirtySectionsRef.current[key] = false
      delete pendingSectionsRef.current[key]
      await updateSection(weekId, key, null)
      setSectionsState((prev) => ({ ...prev, [key]: null }))
      setConfirmRemoveSection(null)
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      recomputePendingFlag()
    } catch (err) {
      setSaveStatus('error')
      setSaveErrorMessage(err instanceof Error ? err.message : 'Lỗi xoá mục')
      setConfirmRemoveSection(null)
    } finally {
      setRemovingSection(false)
    }
  }

  const handleSavePeriod = async (patch: WeekMetaPatch) => {
    await updateWeekMeta(weekId, patch)
    setSaveStatus('saved')
    setLastSavedAt(new Date())
  }

  const handleFinalize = async () => {
    await flushAllPendingSaves()
    await finalizeWeek(weekId)
  }

  const handleReopen = async () => {
    await reopenWeek(weekId)
  }

  const fallbackCurrentWeek = useMemo(() => currentWeekId(todayVN(), weeks), [weeks])

  if (loading && !report) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-sm text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        <p>Đang tải nội dung giao ban tuần…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-red-700 text-base">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Không tải được tuần giao ban</span>
          </div>
          <p className="text-slate-700">{error.message}</p>
          <Link
            href={`/weekly-reports/${fallbackCurrentWeek}`}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 min-h-[44px] sm:min-h-[32px] font-medium text-white hover:bg-slate-800"
          >
            Về tuần hiện tại
          </Link>
        </div>
      </div>
    )
  }

  if (!report) return null

  const editable = report.status === 'draft'
  const deputyLabel = config.deputySectionLabel || RICH_SECTION_LABELS.deputyOpinions
  const sectionsReady = hydratedWeekId === weekId
  const proposedEnabled = sectionsState.proposedSchedule !== null
  const deputyEnabled = sectionsState.deputyOpinions !== null

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-3">
      {/* Toast mang việc thường xuyên */}
      {carriedToastCount > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>
              Đã mang <strong>{carriedToastCount}</strong> việc thường xuyên từ tuần trước.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <button
                type="button"
                onClick={handleUndoCarried}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 min-h-[44px] sm:min-h-[28px] text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Hoàn tác</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCarriedToastCount(0)}
              aria-label="Đóng thông báo"
              className="tap rounded-lg text-emerald-800 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header tuần */}
      <WeekHeader
        report={report}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        saveErrorMessage={saveErrorMessage}
        onRetrySave={() => void flushAllPendingSaves()}
        onSaveNow={editable ? () => void handleSaveNow() : undefined}
        onOpenPeriodDialog={() => setPeriodDialogOpen(true)}
        weeks={weeks}
        onSelectWeek={(id) => { if (id !== weekId) router.push(`/weekly-reports/${id}`) }}
        currentWeekHref={
          fallbackCurrentWeek !== weekId ? `/weekly-reports/${fallbackCurrentWeek}` : undefined
        }
      />

      {!editable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Tuần giao ban này đã <strong>Chốt</strong>. Bấm nút <strong>&ldquo;Mở lại&rdquo;</strong> ở cuối trang nếu cần chỉnh sửa.
        </div>
      )}

      {/* Tabs: nội dung giao ban | số liệu tuần */}
      <div role="tablist" aria-label="Phần của báo cáo tuần" className="flex gap-1 border-b border-slate-200">
        {([
          ['content', 'Nội dung giao ban'],
          ['stats', 'Số liệu tuần'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`-mb-px border-b-2 px-3 min-h-[44px] sm:min-h-[36px] text-sm font-semibold transition-colors ${
              activeTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Kept mounted (hidden) so autosave timers and editors are not torn down when switching tabs */}
      <div role="tabpanel" className={activeTab === 'content' ? 'space-y-3' : 'hidden'}>
        {/* Mục 1 + Gợi ý Công việc */}
        <div>
          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 sm:p-4 shadow-sm space-y-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {report.unitHeading || config.unitHeading || '1. KHTH'}
                  </h2>
                  <p className="text-sm font-medium text-slate-700">
                    Tình hình thực hiện nhiệm vụ tuần qua:
                  </p>
                </div>
                <PrevNextWeekImport
                  prevWeekId={prevWeek?.id ?? null}
                  prevNextWeek={prevWeek?.sections?.nextWeek?.docJson ?? prevWeek?.sections?.nextWeek?.plainText}
                  workItems={workItems}
                  onChange={handleWorkItemsChange}
                  editable={editable}
                />
              </div>

              <WorkItemOutliner
                items={workItems}
                onChange={handleWorkItemsChange}
                editable={editable}
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <AdvisoryList weekId={weekId} editable={editable} />
            </div>
          </section>

          {/* Floating popup — renders nothing when there is no suggestion */}
          <TaskSuggestions
            periodStart={report.periodStart}
            periodEnd={report.periodEnd}
            workItems={workItems}
            onAddTask={handleAddTaskSuggestion}
            onAddTasks={handleAddTaskSuggestions}
            editable={editable}
          />
        </div>

        {/* Mục 2: Ý kiến */}
        <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 sm:p-4 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900">{RICH_SECTION_LABELS.opinions}</h2>
          {sectionsReady ? (
            <RichEditor
              value={sectionsState.opinions?.docJson ?? null}
              onChange={(json, plain) => handleSectionChange('opinions', json, plain)}
              weekId={weekId}
              section="opinions"
              editable={editable}
              placeholder="Ghi ý kiến chỉ đạo, góp ý hoặc dán ảnh chụp công văn…"
            />
          ) : (
            <div className="min-h-[120px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          )}
        </section>

        {/* Mục 3: Tuần tới */}
        <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 sm:p-4 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900">{RICH_SECTION_LABELS.nextWeek}</h2>
          {sectionsReady ? (
            <RichEditor
              value={sectionsState.nextWeek?.docJson ?? null}
              onChange={(json, plain) => handleSectionChange('nextWeek', json, plain)}
              weekId={weekId}
              section="nextWeek"
              editable={editable}
              placeholder="Nhập dự kiến công việc, trọng tâm tuần tới…"
            />
          ) : (
            <div className="min-h-[120px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          )}
        </section>

        {/* Nút bật 2 mục tuỳ chọn */}
        {editable && (!proposedEnabled || !deputyEnabled) && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm">
            <span className="font-medium text-slate-700 mr-1">+ Thêm mục:</span>
            {!proposedEnabled && (
              <button
                type="button"
                onClick={() => void handleEnableOptionalSection('proposedSchedule')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>{RICH_SECTION_LABELS.proposedSchedule}</span>
              </button>
            )}
            {!deputyEnabled && (
              <button
                type="button"
                onClick={() => void handleEnableOptionalSection('deputyOpinions')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>{deputyLabel}</span>
              </button>
            )}
          </div>
        )}

        {/* Mục tuỳ chọn: Đề xuất lịch tuần tới */}
        {proposedEnabled && (
          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 sm:p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {RICH_SECTION_LABELS.proposedSchedule}
              </h2>
              {editable && (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveSection('proposedSchedule')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 min-h-[44px] sm:min-h-[32px] text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Xoá mục</span>
                </button>
              )}
            </div>
            {sectionsReady ? (
              <RichEditor
                value={sectionsState.proposedSchedule?.docJson ?? null}
                onChange={(json, plain) => handleSectionChange('proposedSchedule', json, plain)}
                weekId={weekId}
                section="proposedSchedule"
                editable={editable}
                placeholder="Nhập đề xuất lịch họp, lịch công tác tuần tới…"
              />
            ) : (
              <div className="min-h-[120px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
            )}
          </section>
        )}

        {/* Mục tuỳ chọn: Ý kiến PGĐ */}
        {deputyEnabled && (
          <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 sm:p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">{deputyLabel}</h2>
              {editable && (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveSection('deputyOpinions')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 min-h-[44px] sm:min-h-[32px] text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Xoá mục</span>
                </button>
              )}
            </div>
            {sectionsReady ? (
              <RichEditor
                value={sectionsState.deputyOpinions?.docJson ?? null}
                onChange={(json, plain) => handleSectionChange('deputyOpinions', json, plain)}
                weekId={weekId}
                section="deputyOpinions"
                editable={editable}
                placeholder={`Nhập ${deputyLabel.toLowerCase()}…`}
              />
            ) : (
              <div className="min-h-[120px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
            )}
          </section>
        )}

      </div>

      <div role="tabpanel" className={activeTab === 'stats' ? 'space-y-3' : 'hidden'}>
        {/* Số liệu tuần bcsolieu */}
        <WeeklyStatsPanel
          weekId={weekId}
          periodStart={report.periodStart}
          periodEnd={report.periodEnd}
          statsSnapshotJson={report.statsSnapshotJson}
          statsFetchedAt={report.statsFetchedAt}
          editable={editable}
        />

      </div>

      {/* Thanh chốt / mở lại tuần */}
      <FinalizeBar
        status={report.status}
        finalizedAt={report.finalizedAt}
        hasPendingSaves={hasPendingDirty}
        onFinalize={handleFinalize}
        onReopen={handleReopen}
      />

      {/* Dialog chỉnh kỳ / tuần đặc biệt */}
      <PeriodEditDialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        report={report}
        weeks={weeks}
        onSave={handleSavePeriod}
      />

      {/* Xác nhận xoá mục tuỳ chọn */}
      <ResponsiveModal
        open={confirmRemoveSection !== null}
        onClose={() => !removingSection && setConfirmRemoveSection(null)}
        title="Xác nhận xoá mục tuỳ chọn"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={removingSection}
              onClick={() => setConfirmRemoveSection(null)}
              className="min-h-[44px] sm:min-h-[32px] text-sm"
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removingSection}
              onClick={() => void handleConfirmRemoveOptionalSection()}
              className="min-h-[44px] sm:min-h-[32px] text-sm"
            >
              {removingSection ? 'Đang xoá…' : 'Xoá mục'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          Bạn có chắc muốn xoá mục{' '}
          <strong>
            {confirmRemoveSection === 'deputyOpinions'
              ? deputyLabel
              : confirmRemoveSection
                ? RICH_SECTION_LABELS[confirmRemoveSection]
                : ''}
          </strong>
          ? Nội dung đang có trong mục này sẽ bị xoá khỏi tuần giao ban.
        </p>
      </ResponsiveModal>
    </div>
  )
}

export default function WeeklyReportDetailPage() {
  const params = useParams<{ weekId: string }>()
  const weekId = Array.isArray(params?.weekId) ? params.weekId[0] : params?.weekId || ''
  const { isAdmin, loading: roleLoading } = useRole()
  const fallbackWeekId = currentWeekId(todayVN(), [])

  if (roleLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-red-700 text-base">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>Không có quyền truy cập</span>
          </div>
          <p className="text-slate-700">
            Module Giao ban tuần chỉ dành cho tài khoản quản trị viên.
          </p>
          <Link
            href="/documents"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 min-h-[44px] sm:min-h-[32px] font-medium text-white hover:bg-slate-800"
          >
            Quay về Văn bản
          </Link>
        </div>
      </div>
    )
  }

  if (!isValidIsoDate(weekId)) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-800 text-base">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>Mã tuần không hợp lệ</span>
          </div>
          <p className="text-slate-700">
            Định dạng tuần phải là ngày Thứ 6 giao ban dạng <code className="rounded bg-slate-100 px-1.5 py-0.5">YYYY-MM-DD</code> (ví dụ <code className="rounded bg-slate-100 px-1.5 py-0.5">{fallbackWeekId}</code>).
          </p>
          <Link
            href={`/weekly-reports/${fallbackWeekId}`}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 min-h-[44px] sm:min-h-[32px] font-medium text-white hover:bg-blue-700"
          >
            Về tuần hiện tại
          </Link>
        </div>
      </div>
    )
  }

  return <WeeklyReportWorkspace weekId={weekId} />
}
