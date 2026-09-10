'use client'

import React, { useState, useMemo } from 'react'
import { Calendar, Clock, RefreshCw, Save, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { createTaskSeries, triggerSeriesGenerationNow } from '@/lib/tasks/series'
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
  
  // Time selection (hour / minute)
  const [occurrenceTime, setOccurrenceTime] = useState('08:00')

  // Monthly date range options (e.g. days 1-5 or single day)
  const [monthlyMode, setMonthlyMode] = useState<'single' | 'range'>('single')
  const [singleMonthDay, setSingleMonthDay] = useState<number>(1)
  const [monthDayStart, setMonthDayStart] = useState<number>(1)
  const [monthDayEnd, setMonthDayEnd] = useState<number>(5)

  // Yearly month range options (e.g. months 1-3 or single month)
  const [yearlyMode, setYearlyMode] = useState<'single' | 'range'>('single')
  const [singleMonth, setSingleMonth] = useState<number>(1)
  const [monthStart, setMonthStart] = useState<number>(1)
  const [monthEnd, setMonthEnd] = useState<number>(3)

  const [assigneeId, setAssigneeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [rollingWindowDays, setRollingWindowDays] = useState(14)
  const [leadDays, setLeadDays] = useState(3)
  const [dueOffsetMinutes, setDueOffsetMinutes] = useState(0)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [autoGenerateNow, setAutoGenerateNow] = useState(true)

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const toggleWeekday = (wd: number) => {
    setByWeekday(prev =>
      prev.includes(wd) ? prev.filter(d => d !== wd) : [...prev, wd].sort()
    )
  }

  // Calculate resolved month days
  const resolvedMonthDays = useMemo(() => {
    if (frequency !== 'monthly' && frequency !== 'yearly') return null
    if (monthlyMode === 'single') {
      return [singleMonthDay]
    } else {
      const s = Math.min(monthDayStart, monthDayEnd)
      const e = Math.max(monthDayStart, monthDayEnd)
      const days: number[] = []
      for (let d = s; d <= e; d++) days.push(d)
      return days
    }
  }, [frequency, monthlyMode, singleMonthDay, monthDayStart, monthDayEnd])

  // Calculate resolved months for yearly
  const resolvedMonths = useMemo(() => {
    if (frequency !== 'yearly') return null
    if (yearlyMode === 'single') {
      return [singleMonth]
    } else {
      const s = Math.min(monthStart, monthEnd)
      const e = Math.max(monthStart, monthEnd)
      const months: number[] = []
      for (let m = s; m <= e; m++) months.push(m)
      return months
    }
  }, [frequency, yearlyMode, singleMonth, monthStart, monthEnd])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const seriesId = await createTaskSeries({
        title,
        description: description || null,
        frequency,
        interval,
        byWeekday: frequency === 'weekly' ? byWeekday : null,
        byMonthDay: resolvedMonthDays,
        byMonth: resolvedMonths,
        bySetPos: null,
        anchorDate: Timestamp.fromDate(new Date(startDate)),
        timezone: 'Asia/Ho_Chi_Minh',
        occurrenceTime: occurrenceTime || '08:00',
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

      // Instantly generate first occurrence if requested
      if (autoGenerateNow) {
        try {
          await triggerSeriesGenerationNow(seriesId)
        } catch (genErr) {
          console.warn('Initial occurrence generation hint:', genErr)
        }
      }

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
          placeholder="VD: Báo cáo tuần, Đối soát dữ liệu, Kiểm tra hồ sơ..."
          required
        />
      </div>

      {/* Frequency & Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Tần suất</label>
          <div className="grid grid-cols-4 gap-1 mt-1">
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

        {/* Time of day */}
        <div>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Giờ / Phút thực hiện
          </label>
          <input
            type="time"
            value={occurrenceTime}
            onChange={e => setOccurrenceTime(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Interval */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Chu kỳ: Mỗi</label>
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

      {/* Monthly: Day of month or Range of days */}
      {frequency === 'monthly' && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="monthlyMode"
                checked={monthlyMode === 'single'}
                onChange={() => setMonthlyMode('single')}
                className="text-blue-600"
              />
              Ngày cụ thể
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="monthlyMode"
                checked={monthlyMode === 'range'}
                onChange={() => setMonthlyMode('range')}
                className="text-blue-600"
              />
              Khoảng ngày (VD: ngày 1 - 5)
            </label>
          </div>

          {monthlyMode === 'single' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Vào ngày:</span>
              <select
                value={singleMonthDay}
                onChange={e => setSingleMonthDay(parseInt(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Ngày {d}</option>
                ))}
                <option value={-1}>Ngày cuối cùng của tháng</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600">Từ ngày:</span>
              <select
                value={monthDayStart}
                onChange={e => setMonthDayStart(parseInt(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Ngày {d}</option>
                ))}
              </select>
              <span className="text-xs text-slate-600">đến ngày:</span>
              <select
                value={monthDayEnd}
                onChange={e => setMonthDayEnd(parseInt(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Ngày {d}</option>
                ))}
              </select>
              <span className="text-xs text-blue-600 font-medium ml-1">
                (Mỗi tháng sinh từ ngày {Math.min(monthDayStart, monthDayEnd)} đến {Math.max(monthDayStart, monthDayEnd)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Yearly: Month range or Single month */}
      {frequency === 'yearly' && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="yearlyMode"
                checked={yearlyMode === 'single'}
                onChange={() => setYearlyMode('single')}
                className="text-blue-600"
              />
              Tháng cố định
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="yearlyMode"
                checked={yearlyMode === 'range'}
                onChange={() => setYearlyMode('range')}
                className="text-blue-600"
              />
              Khoảng tháng (VD: tháng 1 - 3)
            </label>
          </div>

          {yearlyMode === 'single' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Vào tháng:</span>
              <select
                value={singleMonth}
                onChange={e => setSingleMonth(parseInt(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600">Từ tháng:</span>
              <select
                value={monthStart}
                onChange={e => setMonthStart(parseInt(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <span className="text-xs text-slate-600">đến tháng:</span>
              <select
                value={monthEnd}
                onChange={e => setMonthEnd(parseInt(e.target.value))}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>
          )}
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

      {/* Auto generate now checkbox */}
      <div className="bg-blue-50/60 border border-blue-200/70 rounded-xl p-3 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-900">
          <input
            type="checkbox"
            checked={autoGenerateNow}
            onChange={e => setAutoGenerateNow(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 border-blue-300 focus:ring-blue-500"
          />
          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Tự động sinh ngay công việc cho kỳ hiện tại để xử lý ngay</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Hủy</Button>
        <Button type="submit" size="sm" disabled={loading || !title.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? <Clock className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Tạo định kỳ
        </Button>
      </div>
    </form>
  )
}
