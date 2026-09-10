'use client'

import React, { useState } from 'react'
import {
  RefreshCw, Plus, Pause, Play, Square, Calendar,
  Clock, User, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { useTaskSeries } from '@/hooks/useTaskSeries'
import { SeriesForm } from '@/components/tasks/SeriesForm'
import { pauseTaskSeries, resumeTaskSeries, endTaskSeries } from '@/lib/tasks/series'
import type { TaskSeries } from '@/types/tasks'

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
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function RecurringPage() {
  const { staffId, staffName } = useRole()
  const { seriesList, loading } = useTaskSeries()
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            Công việc định kỳ
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{seriesList.length} chuỗi</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Tạo định kỳ
        </Button>
      </div>

      {/* Series list */}
      <div className="space-y-3">
        {seriesList.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Chưa có công việc định kỳ nào</p>
            <p className="text-xs text-slate-400 mt-1">Tạo chuỗi để tự động sinh công việc theo lịch</p>
          </div>
        )}

        {seriesList.map((series: TaskSeries) => (
          <div key={series.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{series.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[series.status]}`}>
                    {series.status === 'active' ? 'Hoạt động' : series.status === 'paused' ? 'Tạm dừng' : 'Kết thúc'}
                  </span>
                </div>

                {/* Schedule info */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {FREQ_LABELS[series.frequency || 'weekly']}
                    {series.interval > 1 && ` (mỗi ${series.interval})`}
                  </span>
                  {series.byWeekday && series.byWeekday.length > 0 && (
                    <span>
                      {series.byWeekday.map(wd => {
                        const labels: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' }
                        return labels[wd]
                      }).join(', ')}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Từ {formatDate(series.startDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {series.lastGeneratedDate ? `Đã sinh: ${formatDate(series.lastGeneratedDate)}` : 'Chưa sinh'}
                  </span>
                </div>

                {series.description && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{series.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {actionLoading === series.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <>
                    {series.status === 'active' && (
                      <button
                        onClick={() => handlePause(series.id)}
                        className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                        title="Tạm dừng"
                      >
                        <Pause className="w-3.5 h-3.5 text-amber-500" />
                      </button>
                    )}
                    {series.status === 'paused' && (
                      <button
                        onClick={() => handleResume(series.id)}
                        className="p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                        title="Tiếp tục"
                      >
                        <Play className="w-3.5 h-3.5 text-green-500" />
                      </button>
                    )}
                    {series.status !== 'ended' && (
                      <button
                        onClick={() => handleEnd(series.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Kết thúc"
                      >
                        <Square className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
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
