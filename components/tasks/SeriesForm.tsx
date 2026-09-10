'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar, Clock, RefreshCw, Save, X, Sparkles, Plus,
  Trash2, CheckSquare, ShieldAlert, ArrowRight, UserCheck, Users, Building, Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStaff } from '@/hooks/useStaff'
import { useDepartments } from '@/hooks/useDepartments'
import { CoAssigneePicker } from '@/components/documents/CoAssigneePicker'
import { CoDepartmentPicker } from '@/components/tasks/CoDepartmentPicker'
import { createTaskSeries, updateTaskSeries, triggerSeriesGenerationNow } from '@/lib/tasks/series'
import { Timestamp } from 'firebase/firestore'
import { TASK_PRIORITY_LABELS } from '@/lib/tasks/constants'
import type { TaskPriority, RecurrenceType, WeekendPolicy, SubtaskTemplate, TaskSeries } from '@/types/tasks'

interface SeriesFormProps {
  actorId: string
  actorName: string
  series?: TaskSeries
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

const FULL_WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ Hai', 2: 'Thứ Ba', 3: 'Thứ Tư', 4: 'Thứ Năm', 5: 'Thứ Sáu', 6: 'Thứ Bảy', 7: 'Chủ Nhật',
}

export function SeriesForm({ actorId, actorName, series, onClose }: SeriesFormProps) {
  const isEditing = Boolean(series)
  const { staff: staffList } = useStaff()
  const { departments } = useDepartments()
  const [loading, setLoading] = useState(false)

  // Basic Info
  const [title, setTitle] = useState(series?.title || '')
  const [description, setDescription] = useState(series?.description || '')

  // Recurrence Mode (Calendar vs After-Completion)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(series?.recurrenceType || 'calendar')
  const [completionOffsetDays, setCompletionOffsetDays] = useState<number>(series?.completionOffsetDays || 3)

  // Rules (Calendar mode)
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(series?.frequency || 'weekly')
  const [interval, setInterval] = useState(series?.interval || 1)
  const [byWeekday, setByWeekday] = useState<number[]>(series?.byWeekday && series.byWeekday.length > 0 ? series.byWeekday : [1])
  const [occurrenceTime, setOccurrenceTime] = useState(series?.occurrenceTime || '08:00')

  // Weekend Policy
  const [weekendPolicy, setWeekendPolicy] = useState<WeekendPolicy>(series?.weekendPolicy || 'exact')

  // Monthly date options (single, range, or bySetPos)
  const initialMonthlyMode: 'single' | 'range' | 'setpos' = (series?.bySetPos !== null && series?.bySetPos !== undefined)
    ? 'setpos'
    : (series?.byMonthDay && series.byMonthDay.length > 1 ? 'range' : 'single')
  const [monthlyMode, setMonthlyMode] = useState<'single' | 'range' | 'setpos'>(initialMonthlyMode)
  const [singleMonthDay, setSingleMonthDay] = useState<number>(series?.byMonthDay?.[0] || 1)
  const [monthDayStart, setMonthDayStart] = useState<number>(series?.byMonthDay?.[0] || 1)
  const [monthDayEnd, setMonthDayEnd] = useState<number>(series?.byMonthDay && series.byMonthDay.length > 1 ? series.byMonthDay[series.byMonthDay.length - 1] : 5)
  const [bySetPos, setBySetPos] = useState<number>(series?.bySetPos ?? 1)
  const [setPosWeekday, setSetPosWeekday] = useState<number>(series?.byWeekday?.[0] || 1)

  // Yearly month range options
  const initialYearlyMode: 'single' | 'range' = (series?.byMonth && series.byMonth.length > 1) ? 'range' : 'single'
  const [yearlyMode, setYearlyMode] = useState<'single' | 'range'>(initialYearlyMode)
  const [singleMonth, setSingleMonth] = useState<number>(series?.byMonth?.[0] || 1)
  const [monthStart, setMonthStart] = useState<number>(series?.byMonth?.[0] || 1)
  const [monthEnd, setMonthEnd] = useState<number>(series?.byMonth && series.byMonth.length > 1 ? series.byMonth[series.byMonth.length - 1] : 3)

  // Subtask templates
  const [subtasks, setSubtasks] = useState<string[]>(series?.defaultSubtasks?.map(st => st.title) || [])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  // Assignment & defaults (Standardized Document Pattern: Chính & Phối hợp)
  const [assigneeId, setAssigneeId] = useState(series?.defaultAssigneeId || '')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(series?.defaultCollaboratorIds || [])
  const [departmentId, setDepartmentId] = useState(series?.defaultDepartmentId || '')
  const [cooperatingDepartmentIds, setCooperatingDepartmentIds] = useState<string[]>(series?.defaultCooperatingDepartmentIds || [])

  const [priority, setPriority] = useState<TaskPriority>(series?.defaultPriority || 'normal')
  const [rollingWindowDays, setRollingWindowDays] = useState(series?.rollingWindowDays || 14)
  const [leadDays, setLeadDays] = useState(series?.leadDays ?? 3)
  const [dueOffsetMinutes, setDueOffsetMinutes] = useState(series?.dueOffsetMinutes || 0)

  // Start Date
  const initialStartDate = useMemo(() => {
    if (!series?.startDate) return new Date().toISOString().slice(0, 10)
    const sDate = series.startDate as any
    const d = sDate?.toDate ? sDate.toDate() : new Date(sDate?.seconds ? sDate.seconds * 1000 : sDate)
    return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10)
  }, [series?.startDate])
  const [startDate, setStartDate] = useState(initialStartDate)
  const [autoGenerateNow, setAutoGenerateNow] = useState(!isEditing)

  const activeStaff = useMemo(() => staffList.filter(s => s.isActive), [staffList])

  const toggleWeekday = (wd: number) => {
    setByWeekday(prev =>
      prev.includes(wd) ? prev.filter(d => d !== wd) : [...prev, wd].sort()
    )
  }

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    setSubtasks(prev => [...prev, newSubtaskTitle.trim()])
    setNewSubtaskTitle('')
  }

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index))
  }

  // Calculate resolved month days
  const resolvedMonthDays = useMemo(() => {
    if (frequency !== 'monthly' && frequency !== 'yearly') return null
    if (monthlyMode === 'setpos') return null
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
      const defaultSubtasks: SubtaskTemplate[] = subtasks.map((stTitle, i) => ({
        order: i + 1,
        title: stTitle,
        description: null,
        defaultAssigneeRole: null,
        estimatedMinutes: null,
      }))

      if (series) {
        // Edit Mode: Update existing series
        await updateTaskSeries(series.id, {
          title,
          description: description || null,
          recurrenceType,
          completionOffsetDays: recurrenceType === 'after_completion' ? completionOffsetDays : undefined,
          frequency: recurrenceType === 'after_completion' ? 'daily' : frequency,
          interval: recurrenceType === 'after_completion' ? 1 : interval,
          byWeekday: recurrenceType === 'after_completion'
            ? null
            : (frequency === 'monthly' && monthlyMode === 'setpos' ? [setPosWeekday] : (frequency === 'weekly' ? byWeekday : null)),
          byMonthDay: recurrenceType === 'after_completion' ? null : resolvedMonthDays,
          byMonth: recurrenceType === 'after_completion' ? null : resolvedMonths,
          bySetPos: (recurrenceType === 'calendar' && frequency === 'monthly' && monthlyMode === 'setpos') ? bySetPos : null,
          anchorDate: Timestamp.fromDate(new Date(startDate)),
          weekendPolicy,
          occurrenceTime: occurrenceTime || '08:00',
          dueOffsetMinutes,
          leadDays,
          startDate: Timestamp.fromDate(new Date(startDate)),
          rollingWindowDays,
          defaultAssigneeId: assigneeId || null,
          defaultCollaboratorIds: collaboratorIds,
          defaultDepartmentId: departmentId || null,
          defaultCooperatingDepartmentIds: cooperatingDepartmentIds,
          defaultPriority: priority,
          defaultSubtasks,
        }, actorId)

        if (autoGenerateNow) {
          try {
            await triggerSeriesGenerationNow(series.id)
          } catch (genErr) {
            console.warn('Manual generation after edit hint:', genErr)
          }
        }

        onClose()
        return
      }

      // Create Mode: Create new series
      const seriesId = await createTaskSeries({
        title,
        description: description || null,
        recurrenceType,
        completionOffsetDays: recurrenceType === 'after_completion' ? completionOffsetDays : undefined,
        frequency: recurrenceType === 'after_completion' ? 'daily' : frequency,
        interval: recurrenceType === 'after_completion' ? 1 : interval,
        byWeekday: recurrenceType === 'after_completion'
          ? null
          : (frequency === 'monthly' && monthlyMode === 'setpos' ? [setPosWeekday] : (frequency === 'weekly' ? byWeekday : null)),
        byMonthDay: recurrenceType === 'after_completion' ? null : resolvedMonthDays,
        byMonth: recurrenceType === 'after_completion' ? null : resolvedMonths,
        bySetPos: (recurrenceType === 'calendar' && frequency === 'monthly' && monthlyMode === 'setpos') ? bySetPos : null,
        anchorDate: Timestamp.fromDate(new Date(startDate)),
        timezone: 'Asia/Ho_Chi_Minh',
        weekendPolicy,
        occurrenceTime: occurrenceTime || '08:00',
        dueOffsetMinutes,
        leadDays,
        status: 'active',
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: null,
        misfirePolicy: 'CREATE_MISSED',
        rollingWindowDays,
        defaultAssigneeId: assigneeId || null,
        defaultCollaboratorIds: collaboratorIds,
        defaultFollowerIds: [],
        defaultPriority: priority,
        defaultEstimatedMinutes: null,
        defaultDossierIds: [],
        defaultDocumentIds: [],
        defaultDepartmentId: departmentId || null,
        defaultCooperatingDepartmentIds: cooperatingDepartmentIds,
        defaultTagIds: [],
        defaultSubtasks,
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
      console.error('Save series failed:', err)
      alert('Không thể lưu công việc định kỳ. Vui lòng thử lại!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-500" />
          {isEditing ? 'Chỉnh sửa chuỗi công việc định kỳ' : 'Tạo công việc định kỳ thông minh'}
        </h2>
        <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recurrence Mode Selector Tabs */}
      <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
        <button
          type="button"
          onClick={() => setRecurrenceType('calendar')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            recurrenceType === 'calendar'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Theo lịch cố định (Calendar-based)
        </button>
        <button
          type="button"
          onClick={() => setRecurrenceType('after_completion')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            recurrenceType === 'after_completion'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Sau khi hoàn thành (Completion-based)
        </button>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-slate-600">Tên công việc *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="VD: Báo cáo tuần, Đối soát dữ liệu, Bảo trì hệ thống..."
          required
        />
      </div>

      {/* Completion-based settings */}
      {recurrenceType === 'after_completion' ? (
        <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/70 space-y-2">
          <p className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
            <ArrowRight className="w-4 h-4 text-blue-600" />
            Quy tắc lặp sau khi hoàn thành
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Kỳ tiếp theo sẽ chỉ tự động sinh sau khi công việc kỳ trước được đánh dấu hoàn thành.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-700 font-medium">Tạo kỳ tiếp theo sau:</span>
            <input
              type="number"
              min={1}
              max={180}
              value={completionOffsetDays}
              onChange={e => setCompletionOffsetDays(parseInt(e.target.value) || 1)}
              className="w-16 px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-sm text-center font-bold text-blue-600"
            />
            <span className="text-xs text-slate-600">ngày kể từ khi hoàn thành kỳ trước.</span>
          </div>
        </div>
      ) : (
        /* Calendar-based settings */
        <>
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

          {/* Monthly: Day of month or Range or RFC 5545 bySetPos */}
          {frequency === 'monthly' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center gap-4 text-xs flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="monthlyMode"
                    checked={monthlyMode === 'single'}
                    onChange={() => setMonthlyMode('single')}
                    className="text-blue-600"
                  />
                  Ngày cố định
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="monthlyMode"
                    checked={monthlyMode === 'range'}
                    onChange={() => setMonthlyMode('range')}
                    className="text-blue-600"
                  />
                  Khoảng ngày (1 - 5)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-blue-700">
                  <input
                    type="radio"
                    name="monthlyMode"
                    checked={monthlyMode === 'setpos'}
                    onChange={() => setMonthlyMode('setpos')}
                    className="text-blue-600"
                  />
                  Thứ trong tháng (RFC 5545)
                </label>
              </div>

              {monthlyMode === 'single' && (
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
              )}

              {monthlyMode === 'range' && (
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
                </div>
              )}

              {monthlyMode === 'setpos' && (
                <div className="flex items-center gap-2 flex-wrap bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-600">Vào:</span>
                  <select
                    value={setPosWeekday}
                    onChange={e => setSetPosWeekday(parseInt(e.target.value))}
                    className="px-2.5 py-1 border border-slate-200 bg-slate-50 rounded text-xs font-semibold text-slate-800"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(wd => (
                      <option key={wd} value={wd}>{FULL_WEEKDAY_LABELS[wd]}</option>
                    ))}
                  </select>
                  <select
                    value={bySetPos}
                    onChange={e => setBySetPos(parseInt(e.target.value))}
                    className="px-2.5 py-1 border border-slate-200 bg-slate-50 rounded text-xs font-semibold text-blue-700"
                  >
                    <option value={1}>Đầu tiên của tháng</option>
                    <option value={2}>Thứ hai của tháng</option>
                    <option value={3}>Thứ ba của tháng</option>
                    <option value={4}>Thứ tư của tháng</option>
                    <option value={-1}>Cuối cùng của tháng</option>
                  </select>
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
                  Khoảng tháng (1 - 3)
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
        </>
      )}

      {/* Weekend Policy Selector */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          Xử lý khi ngày làm việc trùng vào cuối tuần (T7 / CN)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
            weekendPolicy === 'exact' ? 'bg-white border-blue-400 font-semibold text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-white'
          }`}>
            <input
              type="radio"
              name="weekendPolicy"
              checked={weekendPolicy === 'exact'}
              onChange={() => setWeekendPolicy('exact')}
              className="text-blue-600"
            />
            Giữ đúng ngày
          </label>
          <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
            weekendPolicy === 'shift_friday' ? 'bg-white border-blue-400 font-semibold text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-white'
          }`}>
            <input
              type="radio"
              name="weekendPolicy"
              checked={weekendPolicy === 'shift_friday'}
              onChange={() => setWeekendPolicy('shift_friday')}
              className="text-blue-600"
            />
            Lùi về Thứ Sáu
          </label>
          <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
            weekendPolicy === 'shift_monday' ? 'bg-white border-blue-400 font-semibold text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-white'
          }`}>
            <input
              type="radio"
              name="weekendPolicy"
              checked={weekendPolicy === 'shift_monday'}
              onChange={() => setWeekendPolicy('shift_monday')}
              className="text-blue-600"
            />
            Dời sang Thứ Hai
          </label>
        </div>
      </div>

      {/* Subtask Template Builder */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
        <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            Mẫu việc con tự động sinh cho mỗi kỳ ({subtasks.length})
          </span>
          <span className="text-[10px] text-slate-400 font-normal">Tự động khởi tạo 0% cho mỗi kỳ</span>
        </label>

        {subtasks.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {subtasks.map((st, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 shadow-2xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-4 h-4 rounded bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">{st}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSubtask(idx)}
                  className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={e => setNewSubtaskTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddSubtask()
              }
            }}
            placeholder="Thêm mục việc con cần làm..."
            className="flex-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddSubtask}
            disabled={!newSubtaskTitle.trim()}
            className="h-8 px-2.5 text-xs bg-slate-800 hover:bg-slate-900 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Thêm
          </Button>
        </div>
      </div>

      {/* Assignment & Department: Giao chính & Phối hợp (Parity with Documents) */}
      <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3.5">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
          <UserCheck className="w-4 h-4 text-blue-600" />
          Phân công &amp; Phối hợp mặc định cho mỗi kỳ
        </div>

        {/* Staff Assignment: Người xử lý chính (1 người) & Người phối hợp (nhiều người) */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                Người xử lý chính
              </label>
              <select
                value={assigneeId}
                onChange={e => {
                  const newId = e.target.value
                  setAssigneeId(newId)
                  // If main assignee is also in collaborators, remove it
                  if (newId && collaboratorIds.includes(newId)) {
                    setCollaboratorIds(collaboratorIds.filter(id => id !== newId))
                  }
                }}
                className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chưa giao</option>
                {activeStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.shortName} — {s.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Mức ưu tiên</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Người phối hợp <span className="text-[11px] text-slate-400 font-normal">(Nhiều người, cùng theo dõi và xử lý)</span>
            </label>
            <CoAssigneePicker
              allStaff={staffList}
              mainAssigneeId={assigneeId}
              value={collaboratorIds}
              onChange={setCollaboratorIds}
              placeholder="Tìm và gắp người phối hợp..."
            />
          </div>
        </div>

        {/* Department Assignment: Đơn vị chủ trì (1 đơn vị) & Đơn vị phối hợp (nhiều đơn vị) */}
        {departments.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-200/60">
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-indigo-500" />
                Đơn vị chủ trì
              </label>
              <select
                value={departmentId}
                onChange={e => {
                  const newDept = e.target.value
                  setDepartmentId(newDept)
                  if (newDept && cooperatingDepartmentIds.includes(newDept)) {
                    setCooperatingDepartmentIds(cooperatingDepartmentIds.filter(id => id !== newDept))
                  }
                }}
                className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Không chọn phòng ban</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                Đơn vị phối hợp <span className="text-[11px] text-slate-400 font-normal">(Nhiều phòng ban cùng tham gia)</span>
              </label>
              <CoDepartmentPicker
                departments={departments}
                mainDepartmentId={departmentId}
                value={cooperatingDepartmentIds}
                onChange={setCooperatingDepartmentIds}
                placeholder="Tìm và chọn các đơn vị phối hợp..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Scheduling params */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Ngày bắt đầu</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
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
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
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
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
            />
            <span className="text-[10px] text-slate-400 whitespace-nowrap">ngày</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-slate-600">Mô tả công việc</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
          rows={2}
          placeholder="Mô tả chi tiết hoặc yêu cầu khi thực hiện..."
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
          <span>{isEditing ? 'Sinh thêm 1 công việc cho kỳ hiện tại sau khi lưu' : 'Tự động sinh ngay công việc cho kỳ hiện tại để xử lý ngay'}</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Hủy
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading || !title.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? <Clock className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          {isEditing ? 'Cập nhật chuỗi định kỳ' : 'Lưu chuỗi định kỳ'}
        </Button>
      </div>
    </form>
  )
}
