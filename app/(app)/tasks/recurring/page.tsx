'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Plus, Pause, Play, Square, Calendar,
  Clock, User, Loader2, Sparkles, ChevronDown, ChevronRight,
  ArrowUpRight, CheckCircle2, ListTodo, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { useTaskSeries } from '@/hooks/useTaskSeries'
import { useTasks } from '@/hooks/useTasks'
import { useStaff } from '@/hooks/useStaff'
import { SeriesForm } from '@/components/tasks/SeriesForm'
import { pauseTaskSeries, resumeTaskSeries, endTaskSeries, triggerSeriesGenerationNow } from '@/lib/tasks/series'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/tasks/constants'
import type { TaskSeries, Task } from '@/types/tasks'

const FREQ_LABELS: Record<string, string> = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  yearly: 'Hàng năm',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-slate-100 text-slate-500',
}

function formatDate(ts: any): string {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function RecurringPage() {
  const router = useRouter()
  const { staffId, staffName } = useRole()
  const { seriesList, loading: seriesLoading } = useTaskSeries()
  const { tasks: allTasks, loading: tasksLoading } = useTasks({ view: 'all' })
  const { getStaffName } = useStaff()

  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [generatingSeriesId, setGeneratingSeriesId] = useState<string | null>(null)
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({})

  // Map generated occurrence tasks by seriesId
  const seriesTasksMap = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of allTasks) {
      if (t.seriesId) {
        if (!map[t.seriesId]) map[t.seriesId] = []
        map[t.seriesId].push(t)
      }
    }
    // Sort tasks in each series by occurrenceDate or dueDate descending
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
    setExpandedSeries(prev => ({
      ...prev,
      [seriesId]: !prev[seriesId],
    }))
  }

  const handleGenerateNow = async (seriesId: string) => {
    setGeneratingSeriesId(seriesId)
    try {
      const count = await triggerSeriesGenerationNow(seriesId)
      // Automatically expand to show the newly generated task
      setExpandedSeries(prev => ({ ...prev, [seriesId]: true }))
    } catch (err: any) {
      console.error('Manual generation failed:', err)
      alert(err.message || 'Không thể sinh công việc kỳ này')
    } finally {
      setGeneratingSeriesId(null)
    }
  }

  const handlePause = async (id: string) => {
    setActionLoading(id)
    try { await pauseTaskSeries(id) } finally { setActionLoading(null) }
  }

  const handleResume = async (id: string) => {
    setActionLoading(id)
    try { await resumeTaskSeries(id) } finally { setActionLoading(null) }
  }

  const handleEnd = async (id: string) => {
    if (!confirm('Kết thúc chuỗi định kỳ này?')) return
    setActionLoading(id)
    try { await endTaskSeries(id) } finally { setActionLoading(null) }
  }

  if (seriesLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Công việc định kỳ
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {seriesList.length} chuỗi mẫu • Tự động sinh hoặc bấm sinh ngay để phân công và xử lý
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs">
          <Plus className="w-4 h-4 mr-1" />
          Tạo định kỳ mới
        </Button>
      </div>

      {/* Series list */}
      <div className="space-y-4">
        {seriesList.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-2xs">
            <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-spin-reverse" />
            <p className="text-base font-medium text-slate-700">Chưa có công việc định kỳ nào</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Tạo chuỗi công việc định kỳ hàng ngày, tuần, tháng hoặc năm. Sau đó bạn có thể sinh việc ngay để theo dõi tiến độ và giao việc cho nhân sự.
            </p>
            <Button size="sm" onClick={() => setShowForm(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-1" />
              Tạo chuỗi đầu tiên
            </Button>
          </div>
        )}

        {seriesList.map((series: TaskSeries) => {
          const generatedTasks = seriesTasksMap[series.id] || []
          const isExpanded = expandedSeries[series.id] ?? (generatedTasks.length > 0)
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
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 truncate">{series.title}</h3>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[series.status]}`}>
                        {series.status === 'active' ? 'Đang hoạt động' : series.status === 'paused' ? 'Tạm dừng' : 'Đã kết thúc'}
                      </span>
                      {series.occurrenceTime && (
                        <span className="text-[11px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {series.occurrenceTime}
                        </span>
                      )}
                    </div>

                    {/* Recurrence rules summary */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 mt-2">
                      <span className="flex items-center gap-1 font-medium text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100">
                        <RefreshCw className="w-3 h-3" />
                        {FREQ_LABELS[series.frequency || 'weekly']}
                        {series.interval > 1 && ` (${series.interval} ${series.frequency === 'daily' ? 'ngày' : series.frequency === 'weekly' ? 'tuần' : series.frequency === 'monthly' ? 'tháng' : 'năm'}/lần)`}
                      </span>

                      {series.byWeekday && series.byWeekday.length > 0 && (
                        <span className="text-slate-700">
                          Thứ: <strong>{series.byWeekday.map(wd => {
                            const labels: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' }
                            return labels[wd]
                          }).join(', ')}</strong>
                        </span>
                      )}

                      {series.byMonthDay && series.byMonthDay.length > 0 && (
                        <span className="text-slate-700">
                          Ngày trong tháng: <strong>{series.byMonthDay.includes(-1) ? 'Ngày cuối tháng' : series.byMonthDay.join(', ')}</strong>
                        </span>
                      )}

                      {series.byMonth && series.byMonth.length > 0 && (
                        <span className="text-slate-700">
                          Tháng trong năm: <strong>Tháng {series.byMonth.join(', ')}</strong>
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Từ: {formatDate(series.startDate)}
                      </span>
                    </div>

                    {series.description && (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{series.description}</p>
                    )}
                  </div>

                  {/* Actions & Trigger Button */}
                  <div className="flex items-center gap-2 self-start shrink-0 flex-wrap">
                    {/* Instant Occurrence Generator Button */}
                    <Button
                      size="sm"
                      onClick={() => handleGenerateNow(series.id)}
                      disabled={isGenerating || series.status !== 'active'}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 shadow-2xs font-semibold"
                      title="Sinh công việc ngay cho kỳ này để giao và xử lý"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Sinh việc kỳ này ngay
                    </Button>

                    {/* Pause / Resume / End controls */}
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      {actionLoading === series.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <>
                          {series.status === 'active' && (
                            <button
                              onClick={() => handlePause(series.id)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors"
                              title="Tạm dừng chuỗi"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {series.status === 'paused' && (
                            <button
                              onClick={() => handleResume(series.id)}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors"
                              title="Kích hoạt lại chuỗi"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {series.status !== 'ended' && (
                            <button
                              onClick={() => handleEnd(series.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="Kết thúc chuỗi"
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accordion Bar for Generated Tasks */}
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleExpand(series.id)}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span>Các kỳ công việc đã sinh ({generatedTasks.length})</span>
                </button>

                <span className="text-[11px] text-slate-400">
                  {generatedTasks.length === 0 ? 'Chưa có kỳ nào được sinh' : 'Click vào công việc để xem chi tiết & chat'}
                </span>
              </div>

              {/* Expanded Generated Tasks List */}
              {isExpanded && (
                <div className="p-3.5 sm:p-4 bg-slate-50/40 border-t border-slate-100 space-y-2">
                  {generatedTasks.length === 0 ? (
                    <div className="text-center py-5 px-4 bg-white rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-500">Chưa có công việc nào được sinh cho chuỗi này.</p>
                      <button
                        onClick={() => handleGenerateNow(series.id)}
                        className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Bấm vào đây để sinh công việc kỳ hiện tại
                      </button>
                    </div>
                  ) : (
                    generatedTasks.map((task) => {
                      const assigneeName = task.assigneeName || (task.assigneeId ? getStaffName(task.assigneeId) : 'Chưa giao')
                      const statusColor = TASK_STATUS_COLORS[task.status]

                      return (
                        <div
                          key={task.id}
                          onClick={() => router.push(`/tasks/${task.id}`)}
                          className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 hover:shadow-xs cursor-pointer transition-all group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                                {task.title}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor?.bg} ${statusColor?.text}`}>
                                {TASK_STATUS_LABELS[task.status]}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                Kỳ: {formatDate(task.occurrenceDate || task.createdAt)}
                              </span>
                              {task.dueDate && (
                                <span className="flex items-center gap-1 text-slate-600">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  Hạn: {formatDate(task.dueDate)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                {assigneeName}
                              </span>
                            </div>
                          </div>

                          {/* Progress & Action button */}
                          <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${task.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-700 min-w-[32px] text-right">
                                {task.progress || 0}%
                              </span>
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-blue-600 group-hover:bg-blue-50 px-2 h-7 font-semibold"
                            >
                              Xử lý & Chat
                              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                            </Button>
                          </div>
                        </div>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <SeriesForm
              actorId={staffId || 'unknown'}
              actorName={staffName || 'Unknown'}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
