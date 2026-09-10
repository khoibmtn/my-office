'use client'

import React, { useState, useMemo } from 'react'
import { Calendar, Clock, RefreshCw, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { createTaskSeries } from '@/lib/tasks/series'
import { Timestamp } from 'firebase/firestore'
import { TASK_PRIORITY_LABELS } from '@/lib/tasks/constants'
import type { TaskPriority } from '@/types/tasks'

interface SeriesFormProps {
  actorId: string
  actorName: string
  onClose: () => void
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  yearly: 'Hàng năm',
}

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN',
}

export function SeriesForm({ actorId, actorName, onClose }: SeriesFormProps) {
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly')
  const [interval, setInterval] = useState(1)
  const [byWeekday, setByWeekday] = useState<number[]>([1]) // Monday default
  const [byMonthDay, setByMonthDay] = useState<number[]>([1])
  const [assigneeId, setAssigneeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [rollingWindowDays, setRollingWindowDays] = useState(14)
  const [leadDays, setLeadDays] = useState(3)
  const [dueOffsetMinutes, setDueOffsetMinutes] = useState(0)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const toggleWeekday = (wd: number) => {
    setByWeekday(prev =>
      prev.includes(wd) ? prev.filter(d => d !== wd) : [...prev, wd].sort()
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      await createTaskSeries({
        title,
        description: description || null,
        frequency,
        interval,
        byWeekday: frequency === 'weekly' ? byWeekday : null,
        byMonthDay: (frequency === 'monthly' || frequency === 'yearly') ? byMonthDay : null,
        byMonth: null,
        bySetPos: null,
        anchorDate: Timestamp.fromDate(new Date(startDate)),
        timezone: 'Asia/Ho_Chi_Minh',
        occurrenceTime: '08:00',
        dueOffsetMinutes,
        leadDays,
        status: 'active',
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: null,
        misfirePolicy: 'CREATE_MISSED',
        rollingWindowDays,
        defaultAssigneeId: assigneeId || null,
        defaultCollaboratorIds: [],
        defaultFollowerIds: [],
        defaultPriority: priority,
        defaultEstimatedMinutes: null,
        defaultDossierIds: [],
        defaultDocumentIds: [],
        defaultDepartmentId: departmentId || null,
        defaultTagIds: [],
        defaultSubtasks: [],
        templateId: null,
        createdBy: actorId,
      }, actorId)

      onClose()
    } catch (err) {
      console.error('Create series failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-500" />
          Tạo công việc định kỳ
        </h2>
        <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-slate-600">Tên công việc *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="VD: Báo cáo tuần, Kiểm tra an toàn..."
          required
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="text-xs font-medium text-slate-600">Tần suất</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                frequency === f
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {FREQUENCY_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Interval */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Mỗi</label>
        <input
          type="number"
          min={1}
          max={365}
          value={interval}
          onChange={e => setInterval(parseInt(e.target.value) || 1)}
          className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center"
        />
        <span className="text-xs text-slate-500">
          {frequency === 'daily' ? 'ngày' : frequency === 'weekly' ? 'tuần' : frequency === 'monthly' ? 'tháng' : 'năm'}
        </span>
      </div>

      {/* Weekly: Day picker */}
      {frequency === 'weekly' && (
        <div>
          <label className="text-xs font-medium text-slate-600">Ngày trong tuần</label>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5, 6, 7].map(wd => (
              <button
                key={wd}
                type="button"
                onClick={() => toggleWeekday(wd)}
                className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                  byWeekday.includes(wd)
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {WEEKDAY_LABELS[wd]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly: Day of month */}
      {(frequency === 'monthly' || frequency === 'yearly') && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Ngày</label>
          <select
            value={byMonthDay[0]}
            onChange={e => setByMonthDay([parseInt(e.target.value)])}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value={-1}>Ngày cuối tháng</option>
          </select>
        </div>
      )}

      {/* Assignment */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Người xử lý</label>
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">Chưa giao</option>
            {activeStaff.map(s => (
              <option key={s.id} value={s.id}>{s.shortName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Ưu tiên</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as TaskPriority)}
            className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
          >
            {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scheduling params */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Bắt đầu</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Xuất hiện trước</label>
          <div className="flex items-center gap-1 mt-1">
            <input
              type="number"
              min={0}
              max={30}
              value={leadDays}
              onChange={e => setLeadDays(parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
            />
            <span className="text-[10px] text-slate-400 whitespace-nowrap">ngày</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Cửa sổ lặp</label>
          <div className="flex items-center gap-1 mt-1">
            <input
              type="number"
              min={7}
              max={90}
              value={rollingWindowDays}
              onChange={e => setRollingWindowDays(parseInt(e.target.value) || 14)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
            />
            <span className="text-[10px] text-slate-400 whitespace-nowrap">ngày</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-slate-600">Mô tả</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
          rows={2}
          placeholder="Mô tả ngắn..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Hủy</Button>
        <Button type="submit" size="sm" disabled={loading || !title.trim()}>
          {loading ? <Clock className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Tạo định kỳ
        </Button>
      </div>
    </form>
  )
}
