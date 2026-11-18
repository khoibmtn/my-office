'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Plus,
  Pause,
  Play,
  Calendar,
  Clock,
  User,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  ListTodo,
  AlertCircle,
  Edit3,
  StopCircle,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { useTaskSeries } from '@/hooks/useTaskSeries'
import { useSeriesTasks } from '@/hooks/useScopedTasks'
import { useStaff } from '@/hooks/useStaff'
import { SeriesForm } from '@/components/tasks/SeriesForm'
import {
  pauseTaskSeries,
  resumeTaskSeries,
  endTaskSeries,
  triggerSeriesGenerationNow,
} from '@/lib/tasks/series'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/tasks/constants'
import type { TaskSeries, Task } from '@/types/tasks'

const FREQ_LABELS: Record<string, string> = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  yearly: 'Hàng năm',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800',
  ended: 'bg-slate-100 text-slate-600',
}

function formatDate(ts: any): string {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function RecurringSeriesView() {
  const { staffId, staffName } = useRole()
  const { seriesList, loading: seriesLoading } = useTaskSeries()
  const { tasks: allTasks, loading: tasksLoading } = useSeriesTasks()
  const { getStaffName } = useStaff()

  const [showForm, setShowForm] = useState(false)
  const [editingSeries, setEditingSeries] = useState<TaskSeries | null>(null)
  const [seriesToEnd, setSeriesToEnd] = useState<TaskSeries | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [generatingSeriesId, setGeneratingSeriesId] = useState<string | null>(null)
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Map generated occurrence tasks by seriesId (top-level only, excluding child subtasks)
  const seriesTasksMap = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of allTasks) {
      if (t.seriesId && !t.parentTaskId) {
        if (!map[t.seriesId]) map[t.seriesId] = []
        map[t.seriesId].push(t)
      }
    }
    for (const key in map) {
      map[key].sort((a, b) => {
        const timeA = (a.occurrenceDate as any)?.seconds || (a.createdAt as any)?.seconds || 0
        const timeB = (b.occurrenceDate as any)?.seconds || (b.createdAt as any)?.seconds || 0
        return timeB - timeA
      })
    }
    return map
  }, [allTasks])

  const toggleExpand = (seriesId: string) => {
    setExpandedSeries((prev) => ({
      ...prev,
      [seriesId]: !prev[seriesId],
    }))
  }

  const handleGenerateNow = async (seriesId: string) => {
    setGeneratingSeriesId(seriesId)
    setErrorMsg(null)
    try {
      await triggerSeriesGenerationNow(seriesId)
      setExpandedSeries((prev) => ({ ...prev, [seriesId]: true }))
    } catch (err: any) {
      console.error('Manual generation failed:', err)
      setErrorMsg(err?.message || 'Không thể sinh công việc kỳ này')
    } finally {
      setGeneratingSeriesId(null)
    }
  }

  const handlePause = async (id: string) => {
    setActionLoading(id)
    setErrorMsg(null)
    try {
      await pauseTaskSeries(id)
    } catch (err: any) {
      console.error('Pause error:', err)
      setErrorMsg(err?.message || 'Không thể tạm dừng chuỗi')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResume = async (id: string) => {
    setActionLoading(id)
    setErrorMsg(null)
    try {
      await resumeTaskSeries(id)
    } catch (err: any) {
      console.error('Resume error:', err)
      setErrorMsg(err?.message || 'Không thể kích hoạt lại chuỗi')
    } finally {
      setActionLoading(null)
    }
  }

  const confirmEnd = async () => {
    if (!seriesToEnd) return
    const id = seriesToEnd.id
    setActionLoading(id)
    setErrorMsg(null)
    try {
      await endTaskSeries(id)
      setSeriesToEnd(null)
    } catch (err: any) {
      console.error('End series error:', err)
      setErrorMsg(err?.message || 'Không thể kết thúc chuỗi định kỳ')
    } finally {
      setActionLoading(null)
    }
  }

  if (seriesLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            Công việc định kỳ
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {seriesList.length} chuỗi mẫu · Tự động sinh theo lịch hoặc bấm sinh ngay khi cần
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(true)}
          className="min-h-[44px] h-11 sm:h-9 sm:min-h-[38px] px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-2xs text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Tạo định kỳ mới
        </Button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span className="font-medium">{errorMsg}</span>
          <button
            type="button"
            aria-label="Đóng lỗi"
            onClick={() => setErrorMsg(null)}
            className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center rounded-lg hover:bg-red-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Series list */}
      <div className="space-y-4">
        {seriesList.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-10 text-center shadow-2xs">
            <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-800">Chưa có công việc định kỳ nào</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Tạo chuỗi công việc lặp lại hàng tuần, tháng hoặc năm (ví dụ báo cáo định kỳ có hạn
              chót). Lưu ý: việc thường xuyên không có hạn nên ghim trực tiếp ở trang Giao ban tuần.
            </p>
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="mt-4 min-h-[44px] h-11 sm:h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Tạo chuỗi đầu tiên
            </Button>
          </div>
        )}

        {seriesList.map((series: TaskSeries) => {
          const generatedTasks = seriesTasksMap[series.id] || []
          const isExpanded = expandedSeries[series.id] ?? generatedTasks.length > 0
          const isGenerating = generatingSeriesId === series.id

          return (
            <div
              key={series.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
            >
              {/* Main Series Card */}
              <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 break-words">
                        {series.title}
                      </h3>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[series.status]}`}
                      >
                        {series.status === 'active'
                          ? 'Đang hoạt động'
                          : series.status === 'paused'
                          ? 'Tạm dừng'
                          : 'Đã kết thúc'}
                      </span>
                      {series.recurrenceType === 'after_completion' ? (
                        <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded-md border border-purple-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                          Lặp sau hoàn thành (+{series.completionOffsetDays || 1} ngày)
                        </span>
                      ) : (
                        <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200 inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          Theo lịch cố định
                        </span>
                      )}
                      {series.occurrenceTime && (
                        <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {series.occurrenceTime}
                        </span>
                      )}
                      {series.defaultSubtasks && series.defaultSubtasks.length > 0 && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                          <ListTodo className="w-3.5 h-3.5 text-emerald-600" />
                          {series.defaultSubtasks.length} việc con
                        </span>
                      )}
                    </div>

                    {/* Recurrence rules summary */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600 mt-2">
                      {series.recurrenceType !== 'after_completion' && (
                        <span className="inline-flex items-center gap-1 font-medium text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100">
                          <RefreshCw className="w-3.5 h-3.5" />
                          {FREQ_LABELS[series.frequency || 'weekly']}
                          {series.interval > 1 &&
                            ` (${series.interval} ${
                              series.frequency === 'daily'
                                ? 'ngày'
                                : series.frequency === 'weekly'
                                ? 'tuần'
                                : series.frequency === 'monthly'
                                ? 'tháng'
                                : 'năm'
                            }/lần)`}
                        </span>
                      )}

                      {series.bySetPos !== null && series.bySetPos !== undefined ? (
                        <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          Thứ{' '}
                          {series.byWeekday
                            ?.map(
                              (wd) =>
                                ({
                                  1: 'Hai',
                                  2: 'Ba',
                                  3: 'Tư',
                                  4: 'Năm',
                                  5: 'Sáu',
                                  6: 'Bảy',
                                  7: 'CN',
                                }[wd] || wd)
                            )
                            .join(', ')}{' '}
                          {series.bySetPos === 1
                            ? 'đầu tiên'
                            : series.bySetPos === -1
                            ? 'cuối cùng'
                            : `thứ ${series.bySetPos}`}{' '}
                          của tháng
                        </span>
                      ) : (
                        <>
                          {series.byWeekday && series.byWeekday.length > 0 && (
                            <span className="text-slate-700">
                              Thứ:{' '}
                              <strong>
                                {series.byWeekday
                                  .map((wd) => {
                                    const labels: Record<number, string> = {
                                      1: 'T2',
                                      2: 'T3',
                                      3: 'T4',
                                      4: 'T5',
                                      5: 'T6',
                                      6: 'T7',
                                      7: 'CN',
                                    }
                                    return labels[wd]
                                  })
                                  .join(', ')}
                              </strong>
                            </span>
                          )}

                          {series.byMonthDay && series.byMonthDay.length > 0 && (
                            <span className="text-slate-700">
                              Ngày trong tháng:{' '}
                              <strong>
                                {series.byMonthDay.includes(-1)
                                  ? 'Ngày cuối tháng'
                                  : series.byMonthDay.join(', ')}
                              </strong>
                            </span>
                          )}
                        </>
                      )}

                      {series.weekendPolicy && series.weekendPolicy !== 'exact' && (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                          {series.weekendPolicy === 'shift_friday'
                            ? 'Lùi về Thứ 6 nếu trùng cuối tuần'
                            : 'Dời sang Thứ 2 nếu trùng cuối tuần'}
                        </span>
                      )}

                      {series.byMonth && series.byMonth.length > 0 && (
                        <span className="text-slate-700">
                          Tháng trong năm: <strong>Tháng {series.byMonth.join(', ')}</strong>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Từ: {formatDate(series.startDate)}
                      </span>
                    </div>

                    {series.description && (
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                        {series.description}
                      </p>
                    )}
                  </div>

                  {/* Actions & Trigger Button — always visible, >= 44px on mobile */}
                  <div className="flex items-center gap-2 self-start shrink-0 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingSeries(series)}
                      className="min-h-[44px] h-11 sm:h-9 sm:min-h-[36px] px-3 text-sm text-slate-700 hover:text-blue-600 hover:bg-blue-50 border-slate-200 font-medium"
                      title="Chỉnh sửa cấu hình chuỗi công việc định kỳ này"
                    >
                      <Edit3 className="w-4 h-4 mr-1.5 text-slate-500" />
                      Sửa chuỗi
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleGenerateNow(series.id)}
                      disabled={isGenerating || series.status !== 'active'}
                      className="min-h-[44px] h-11 sm:h-9 sm:min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3.5 shadow-2xs font-medium"
                      title="Sinh công việc ngay cho kỳ này để giao và xử lý"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1.5" />
                      )}
                      Sinh việc kỳ này
                    </Button>

                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      {actionLoading === series.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-2" />
                      ) : (
                        <>
                          {series.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handlePause(series.id)}
                              aria-label="Tạm dừng chuỗi định kỳ"
                              title="Tạm dừng chuỗi định kỳ"
                              className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] inline-flex items-center justify-center rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {series.status === 'paused' && (
                            <button
                              type="button"
                              onClick={() => handleResume(series.id)}
                              aria-label="Kích hoạt lại chuỗi định kỳ"
                              title="Kích hoạt lại chuỗi định kỳ"
                              className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] inline-flex items-center justify-center rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {series.status !== 'ended' && (
                            <button
                              type="button"
                              onClick={() => setSeriesToEnd(series)}
                              aria-label="Kết thúc chuỗi"
                              title="Kết thúc chuỗi (Dừng tự động sinh)"
                              className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] inline-flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                            >
                              <StopCircle className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accordion Bar for Generated Tasks */}
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(series.id)}
                  className="min-h-[44px] sm:min-h-[36px] flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>Các kỳ công việc đã sinh ({generatedTasks.length})</span>
                </button>

                <span className="text-xs text-slate-500 hidden sm:inline">
                  {generatedTasks.length === 0
                    ? 'Chưa có kỳ nào được sinh'
                    : 'Bấm vào công việc để xem chi tiết & trao đổi'}
                </span>
              </div>

              {/* Expanded Generated Tasks List */}
              {isExpanded && (
                <div className="p-3.5 sm:p-4 bg-slate-50/40 border-t border-slate-100 space-y-2">
                  {generatedTasks.length === 0 ? (
                    <div className="text-center py-5 px-4 bg-white rounded-xl border border-dashed border-slate-200 space-y-2">
                      <p className="text-sm text-slate-500">
                        Chưa có công việc nào được sinh cho chuỗi này.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleGenerateNow(series.id)}
                        className="min-h-[44px] sm:min-h-[36px] px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        Sinh công việc kỳ hiện tại
                      </button>
                    </div>
                  ) : (
                    generatedTasks.map((task) => {
                      const assigneeName =
                        task.assigneeName ||
                        (task.assigneeId ? getStaffName(task.assigneeId) : 'Chưa giao')
                      const statusColor = TASK_STATUS_COLORS[task.status]

                      return (
                        <Link
                          key={task.id}
                          href={`/tasks/${task.id}`}
                          className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 hover:shadow-xs cursor-pointer transition-all group block"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-base font-medium text-slate-900 group-hover:text-blue-600 break-words">
                                {task.title}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor?.bg} ${statusColor?.text}`}
                              >
                                {TASK_STATUS_LABELS[task.status]}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Kỳ: {formatDate(task.occurrenceDate || task.createdAt)}
                              </span>
                              {task.dueDate && (
                                <span className="inline-flex items-center gap-1 text-slate-600">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  Hạn: {formatDate(task.dueDate)}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {assigneeName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${task.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-700 min-w-[36px] text-right tabular-nums">
                                {task.progress || 0}%
                              </span>
                            </div>

                            <div className="text-sm text-blue-600 px-2.5 py-1 rounded-md font-semibold inline-flex items-center">
                              Mở việc
                              <ArrowUpRight className="w-4 h-4 ml-0.5" />
                            </div>
                          </div>
                        </Link>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <SeriesForm
              actorId={staffId || 'unknown'}
              actorName={staffName || 'Unknown'}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Edit form modal */}
      {editingSeries && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setEditingSeries(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <SeriesForm
              series={editingSeries}
              actorId={staffId || 'unknown'}
              actorName={staffName || 'Unknown'}
              onClose={() => setEditingSeries(null)}
            />
          </div>
        </div>
      )}

      {/* End series confirmation modal */}
      {seriesToEnd && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSeriesToEnd(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Kết thúc chuỗi định kỳ?</h3>
                <p className="text-sm text-slate-500 font-medium truncate max-w-[280px]">
                  {seriesToEnd.title}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              Hệ thống sẽ <strong>dừng hoàn toàn việc tự động sinh</strong> các kỳ công việc tiếp
              theo của chuỗi này. Các công việc và dữ liệu đã sinh trước đó vẫn được lưu trữ nguyên
              vẹn.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSeriesToEnd(null)}
                disabled={actionLoading === seriesToEnd.id}
                className="min-h-[44px] sm:min-h-[36px] px-4"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmEnd}
                disabled={actionLoading === seriesToEnd.id}
                className="min-h-[44px] sm:min-h-[36px] px-4 bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {actionLoading === seriesToEnd.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <StopCircle className="w-4 h-4 mr-1.5" />
                )}
                Xác nhận kết thúc
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
