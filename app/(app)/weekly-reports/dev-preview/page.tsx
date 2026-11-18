'use client'

import React, { useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import { CheckCircle2, FileText, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { WeekHeader, type SaveIndicatorStatus } from '@/components/weekly-report/WeekHeader'
import { WorkItemOutliner } from '@/components/weekly-report/WorkItemOutliner'
import { TaskSuggestions } from '@/components/weekly-report/TaskSuggestions'
import { RichEditor } from '@/components/weekly-report/RichEditor'
import {
  WeeklyStatsPanel,
  type WeeklyStatsData,
} from '@/components/weekly-report/WeeklyStatsPanel'
import { FinalizeBar } from '@/components/weekly-report/FinalizeBar'
import { PeriodEditDialog, type WeekMetaPatch } from '@/components/weekly-report/PeriodEditDialog'
import { ReadingView } from '@/components/weekly-report/ReadingView'
import {
  formatAdvisoryLine,
  formatAdvisorySummary,
  sortAdvisory,
} from '@/lib/weekly-report/advisory-format'
import { newId } from '@/lib/weekly-report/outline'
import { formatDMY } from '@/lib/weekly-report/period'
import {
  DEFAULT_WEEKLY_REPORT_CONFIG,
  RICH_SECTION_LABELS,
  type AdvisoryDoc,
  type RichSectionKey,
  type WeeklyReport,
  type WeekPeriodInfo,
  type WorkItem,
} from '@/types/weekly-report'
import type { Task } from '@/types/tasks'
import type { UploadImageHandler } from '@/components/weekly-report/extensions/paste-image'

const NOW_TS = Timestamp.fromDate(new Date('2026-11-18T09:00:00+07:00'))

const MOCK_PREV_WEEK: WeekPeriodInfo = {
  id: '2026-11-13',
  meetingDate: '2026-11-13',
  periodStart: '2026-11-06',
  periodEnd: '2026-11-12',
  periodOverridden: false,
  reportMonth: '2026-11',
  reportMonthOverridden: false,
}

const INITIAL_MOCK_REPORT: WeeklyReport = {
  id: '2026-11-20',
  meetingDate: '2026-11-20',
  actualMeetingDate: null,
  periodStart: '2026-11-13',
  periodEnd: '2026-11-19',
  periodOverridden: false,
  periodNote: '',
  reportMonth: '2026-11',
  reportMonthOverridden: false,
  status: 'draft',
  finalizedAt: null,
  unitHeading: '1. KHTH',
  workItems: [
    {
      id: 'item-1',
      text: 'Đảm bảo công tác thường trực chuyên môn và tổng hợp số liệu tuần',
      highlight: false,
      pinned: true,
      order: 0,
      source: 'carried',
      taskId: null,
      children: [
        {
          id: 'child-1',
          text: 'Rà soát báo cáo nhanh các khoa lâm sàng trước 15h Thứ 5',
          highlight: false,
          order: 0,
        },
      ],
    },
    {
      id: 'item-2',
      text: 'Hoàn thiện dự thảo kế hoạch kiểm tra quy chế bệnh viện quý IV (cần trình ký gấp)',
      highlight: true,
      pinned: false,
      order: 1,
      source: 'manual',
      taskId: null,
      children: [],
    },
  ],
  sections: {
    opinions: {
      docJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Đề nghị các khoa gửi báo cáo đúng hạn; ' },
              {
                type: 'text',
                marks: [{ type: 'red' }],
                text: 'lưu ý công tác trực cuối tuần và đối chiếu mã BHYT.',
              },
            ],
          },
        ],
      }),
      plainText: 'Đề nghị các khoa gửi báo cáo đúng hạn; lưu ý công tác trực cuối tuần và đối chiếu mã BHYT.',
      updatedAt: NOW_TS,
    },
    nextWeek: {
      docJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Tổ chức giao ban chuyên môn liên khoa.' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Tổng hợp báo cáo công tác tháng 11.' }],
                  },
                ],
              },
            ],
          },
        ],
      }),
      plainText: 'Tổ chức giao ban chuyên môn liên khoa.\nTổng hợp báo cáo công tác tháng 11.',
      updatedAt: NOW_TS,
    },
    proposedSchedule: null,
    deputyOpinions: null,
  },
  statsSnapshotJson: null,
  statsFetchedAt: null,
  carriedFromWeekId: '2026-11-13',
  createdAt: NOW_TS,
  updatedAt: NOW_TS,
}

const MOCK_ADVISORY: AdvisoryDoc[] = [
  {
    id: 'adv-1',
    type: 'CV',
    title: 'V/v hướng dẫn cập nhật danh mục kỹ thuật chuyên môn mẫu',
    docNumber: '101/CV-KHTH',
    advisedDate: '2026-11-16',
    weekId: '2026-11-20',
    weekIdOverridden: false,
    sourceDocumentIds: ['doc-sample-1'],
    sourceSnapshot: [
      {
        id: 'doc-sample-1',
        docNumber: '88/SYT-NVY',
        title: 'Công văn hướng dẫn rà soát danh mục kỹ thuật',
        sender: 'Sở Y tế',
        issueDate: '2026-11-14',
      },
    ],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: false,
    order: 0,
    taskId: null,
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
  },
  {
    id: 'adv-2',
    type: 'TB',
    title: 'Về việc phân công lịch trực mẫu kỳ nghỉ lễ',
    docNumber: '45/TB-BV',
    advisedDate: '2026-11-18',
    weekId: '2026-11-20',
    weekIdOverridden: false,
    sourceDocumentIds: [],
    sourceSnapshot: [],
    draftLink: null,
    draftDriveFileId: null,
    note: '',
    highlight: true,
    order: 1,
    taskId: null,
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
  },
]

const MOCK_COMPLETED_TASKS: Task[] = [
  {
    id: 'mock-task-1',
    taskCode: 'CV-2026-101',
    title: 'Tổng hợp số liệu khám chữa bệnh tuần mẫu gửi Ban Giám đốc',
    description: null,
    type: 'single',
    status: 'completed',
    priority: 'normal',
    progress: 100,
    progressMode: 'manual',
    isClosed: true,
    startDate: null,
    dueDate: NOW_TS,
    completedAt: NOW_TS,
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
    createdAt: NOW_TS,
    updatedAt: NOW_TS,
    deletedAt: null,
    migratedFromChecklistId: null,
  },
]

const MOCK_STATS_RESPONSE: WeeklyStatsData = {
  prevRange: { from: '2026-11-06', to: '2026-11-12' },
  currRange: { from: '2026-11-13', to: '2026-11-19' },
  rows: [
    { group: 'Bệnh viện', label: 'Tổng lượt khám ngoại trú (mẫu)', prev: 4120, curr: 4385 },
    { group: 'Bệnh viện', label: 'Nhập viện nội trú (mẫu)', prev: 418, curr: 405 },
    { group: 'Cận lâm sàng', label: 'Xét nghiệm huyết học (mẫu)', prev: 1520, curr: 1610 },
  ],
}

export default function WeeklyReportDevPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  const [report, setReport] = useState<WeeklyReport>(INITIAL_MOCK_REPORT)
  const [saveStatus, setSaveStatus] = useState<SaveIndicatorStatus>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => new Date())
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [readMode, setReadMode] = useState(false)
  const [showCarriedToast, setShowCarriedToast] = useState(true)

  const sortedAdvisory = useMemo(() => sortAdvisory(MOCK_ADVISORY), [])
  const advisorySummary = useMemo(
    () => formatAdvisorySummary(sortedAdvisory, DEFAULT_WEEKLY_REPORT_CONFIG.docTypes),
    [sortedAdvisory],
  )

  const mockUploadImage: UploadImageHandler = async (file) => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    const url = URL.createObjectURL(file)
    return { url, imageId: `mock-${Date.now()}` }
  }

  const simulateAutosave = () => {
    setSaveStatus('saving')
    setTimeout(() => {
      setSaveStatus('saved')
      setLastSavedAt(new Date())
    }, 300)
  }

  const handleWorkItemsChange = (nextItems: WorkItem[]) => {
    setReport((prev) => ({ ...prev, workItems: nextItems }))
    simulateAutosave()
  }

  const handleSectionChange = (key: RichSectionKey, docJson: string, plainText: string) => {
    setReport((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: { docJson, plainText, updatedAt: NOW_TS },
      },
    }))
    simulateAutosave()
  }

  const handleAddTask = (task: { id: string; title: string }) => {
    if (report.workItems.some((w) => w.taskId === task.id)) return
    const next: WorkItem[] = [
      ...report.workItems,
      {
        id: newId(),
        text: task.title,
        highlight: false,
        pinned: false,
        order: report.workItems.length,
        source: 'task',
        taskId: task.id,
        children: [],
      },
    ]
    handleWorkItemsChange(next)
  }

  const handleSaveMeta = async (patch: WeekMetaPatch) => {
    setReport((prev) => ({ ...prev, ...patch }))
    simulateAutosave()
  }

  const handleFetchStatsMock = async () => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    return { ok: true as const, data: MOCK_STATS_RESPONSE }
  }

  const handleSaveStatsMock = async (json: string) => {
    setReport((prev) => ({
      ...prev,
      statsSnapshotJson: json,
      statsFetchedAt: Timestamp.now(),
    }))
  }

  if (readMode) {
    return (
      <ReadingView
        report={report}
        advisoryDocs={MOCK_ADVISORY}
        config={DEFAULT_WEEKLY_REPORT_CONFIG}
        onExit={() => setReadMode(false)}
      />
    )
  }

  const editable = report.status === 'draft'
  const proposedEnabled = report.sections.proposedSchedule !== null
  const deputyEnabled = report.sections.deputyOpinions !== null

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-5">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-base text-blue-950 flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong>Chế độ kiểm thử giao diện (dev-preview)</strong> — Dữ liệu giả, không cần đăng nhập, không ghi Firestore hay gọi mạng ngoài.
        </div>
        <button
          type="button"
          onClick={() => {
            setReport(INITIAL_MOCK_REPORT)
            setShowCarriedToast(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 min-h-[44px] sm:min-h-[34px] text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Đặt lại dữ liệu mẫu</span>
        </button>
      </div>

      {showCarriedToast && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-950 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>Đã mang 1 việc thường xuyên từ tuần trước.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleWorkItemsChange(report.workItems.filter((w) => w.source !== 'carried'))
                setShowCarriedToast(false)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 min-h-[44px] sm:min-h-[34px] text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Hoàn tác</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCarriedToast(false)}
              aria-label="Đóng thông báo"
              className="tap rounded-lg text-emerald-800 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <WeekHeader
        report={report}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onRetrySave={simulateAutosave}
        onOpenPeriodDialog={() => setPeriodDialogOpen(true)}
        onOpenReadView={() => setReadMode(true)}
        isPreview
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-5">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{report.unitHeading}</h2>
              <p className="text-base font-medium text-slate-700">
                Tình hình thực hiện nhiệm vụ tuần qua:
              </p>
            </div>

            <WorkItemOutliner
              items={report.workItems}
              onChange={handleWorkItemsChange}
              editable={editable}
            />
          </div>

          {/* Minh hoạ khối AdvisoryList trong dev-preview (không gọi Firestore) */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>{advisorySummary}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                Mẫu hiển thị (T-213)
              </span>
            </div>
            <ul className="space-y-1.5 pl-5 list-disc text-base">
              {sortedAdvisory.map((doc) => (
                <li
                  key={doc.id}
                  className={doc.highlight ? 'font-bold text-red-700' : 'text-slate-800'}
                >
                  <span>{formatAdvisoryLine(doc)}</span>
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({formatDMY(doc.advisedDate)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="lg:col-span-4">
          <TaskSuggestions
            periodStart={report.periodStart}
            periodEnd={report.periodEnd}
            workItems={report.workItems}
            onAddTask={handleAddTask}
            editable={editable}
            tasksOverride={MOCK_COMPLETED_TASKS}
          />
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-slate-900">{RICH_SECTION_LABELS.opinions}</h2>
        <RichEditor
          value={report.sections.opinions?.docJson ?? null}
          onChange={(json, plain) => handleSectionChange('opinions', json, plain)}
          weekId={report.id}
          section="opinions"
          editable={editable}
          uploadImageFn={mockUploadImage}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-slate-900">{RICH_SECTION_LABELS.nextWeek}</h2>
        <RichEditor
          value={report.sections.nextWeek?.docJson ?? null}
          onChange={(json, plain) => handleSectionChange('nextWeek', json, plain)}
          weekId={report.id}
          section="nextWeek"
          editable={editable}
          uploadImageFn={mockUploadImage}
        />
      </section>

      {editable && (!proposedEnabled || !deputyEnabled) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-base">
          <span className="font-medium text-slate-700 mr-1">+ Thêm mục:</span>
          {!proposedEnabled && (
            <button
              type="button"
              onClick={() =>
                handleSectionChange(
                  'proposedSchedule',
                  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
                  '',
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-base font-medium text-slate-800 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              <span>{RICH_SECTION_LABELS.proposedSchedule}</span>
            </button>
          )}
          {!deputyEnabled && (
            <button
              type="button"
              onClick={() =>
                handleSectionChange(
                  'deputyOpinions',
                  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
                  '',
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-base font-medium text-slate-800 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              <span>{DEFAULT_WEEKLY_REPORT_CONFIG.deputySectionLabel}</span>
            </button>
          )}
        </div>
      )}

      {proposedEnabled && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {RICH_SECTION_LABELS.proposedSchedule}
            </h2>
            {editable && (
              <button
                type="button"
                onClick={() =>
                  setReport((prev) => ({
                    ...prev,
                    sections: { ...prev.sections, proposedSchedule: null },
                  }))
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>Xoá mục</span>
              </button>
            )}
          </div>
          <RichEditor
            value={report.sections.proposedSchedule?.docJson ?? null}
            onChange={(json, plain) => handleSectionChange('proposedSchedule', json, plain)}
            weekId={report.id}
            section="proposedSchedule"
            editable={editable}
            uploadImageFn={mockUploadImage}
          />
        </section>
      )}

      {deputyEnabled && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {DEFAULT_WEEKLY_REPORT_CONFIG.deputySectionLabel}
            </h2>
            {editable && (
              <button
                type="button"
                onClick={() =>
                  setReport((prev) => ({
                    ...prev,
                    sections: { ...prev.sections, deputyOpinions: null },
                  }))
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>Xoá mục</span>
              </button>
            )}
          </div>
          <RichEditor
            value={report.sections.deputyOpinions?.docJson ?? null}
            onChange={(json, plain) => handleSectionChange('deputyOpinions', json, plain)}
            weekId={report.id}
            section="deputyOpinions"
            editable={editable}
            uploadImageFn={mockUploadImage}
          />
        </section>
      )}

      <WeeklyStatsPanel
        weekId={report.id}
        periodStart={report.periodStart}
        periodEnd={report.periodEnd}
        statsSnapshotJson={report.statsSnapshotJson}
        statsFetchedAt={report.statsFetchedAt}
        editable={editable}
        onFetchStats={handleFetchStatsMock}
        onSaveSnapshot={handleSaveStatsMock}
      />

      <FinalizeBar
        status={report.status}
        finalizedAt={report.finalizedAt}
        onFinalize={async () => {
          setReport((prev) => ({ ...prev, status: 'finalized', finalizedAt: Timestamp.now() }))
        }}
        onReopen={async () => {
          setReport((prev) => ({ ...prev, status: 'draft', finalizedAt: null }))
        }}
      />

      <PeriodEditDialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        report={report}
        weeks={[MOCK_PREV_WEEK, report]}
        onSave={handleSaveMeta}
      />
    </div>
  )
}
