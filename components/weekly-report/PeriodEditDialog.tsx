'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck2, RotateCcw } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import {
  addDays,
  defaultPeriod,
  diffDays,
  formatDMY,
  reportMonthFor,
} from '@/lib/weekly-report/period'
import type { ISODate, WeeklyReport, WeekPeriodInfo, YearMonth } from '@/types/weekly-report'

export type WeekMetaPatch = Partial<
  Pick<
    WeeklyReport,
    | 'actualMeetingDate'
    | 'periodStart'
    | 'periodEnd'
    | 'periodOverridden'
    | 'periodNote'
    | 'reportMonth'
    | 'reportMonthOverridden'
    | 'unitHeading'
  >
>

export interface PeriodEditDialogProps {
  open: boolean
  onClose: () => void
  report: WeeklyReport
  weeks: WeekPeriodInfo[]
  onSave: (patch: WeekMetaPatch) => Promise<void>
}

function formatYearMonthVN(ym: YearMonth): string {
  const [y, m] = ym.split('-')
  return y && m ? `${m}/${y}` : ym
}

export function PeriodEditDialog({
  open,
  onClose,
  report,
  weeks,
  onSave,
}: PeriodEditDialogProps) {
  const [actualMeetingDate, setActualMeetingDate] = useState<string>('')
  const [periodStart, setPeriodStart] = useState<ISODate>(report.periodStart)
  const [periodEnd, setPeriodEnd] = useState<ISODate>(report.periodEnd)
  const [periodOverridden, setPeriodOverridden] = useState<boolean>(report.periodOverridden)
  const [periodNote, setPeriodNote] = useState<string>(report.periodNote || '')
  const [reportMonthOverridden, setReportMonthOverridden] = useState<boolean>(
    report.reportMonthOverridden,
  )
  const [manualMonth, setManualMonth] = useState<YearMonth>(report.reportMonth)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setActualMeetingDate(report.actualMeetingDate ?? '')
    setPeriodStart(report.periodStart)
    setPeriodEnd(report.periodEnd)
    setPeriodOverridden(report.periodOverridden)
    setPeriodNote(report.periodNote ?? '')
    setReportMonthOverridden(report.reportMonthOverridden)
    setManualMonth(report.reportMonth)
    setError(null)
    // Only re-seed when the dialog opens / another week is shown: Firestore echoes of
    // autosave change `report` identity and must not wipe what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, report.id])

  const prevWeek = useMemo(() => {
    const earlier = weeks
      .filter((w) => w.id < report.id)
      .sort((a, b) => b.id.localeCompare(a.id))
    return earlier[0] ?? null
  }, [weeks, report.id])

  const nextWeek = useMemo(() => {
    const later = weeks
      .filter((w) => w.id > report.id)
      .sort((a, b) => a.id.localeCompare(b.id))
    return later[0] ?? null
  }, [weeks, report.id])

  const validRange = useMemo(
    () => Boolean(periodStart && periodEnd && diffDays(periodStart, periodEnd) >= 0),
    [periodStart, periodEnd],
  )

  const autoMonth = useMemo(() => {
    if (!validRange) return report.reportMonth
    return reportMonthFor(periodStart, periodEnd)
  }, [validRange, periodStart, periodEnd, report.reportMonth])

  const dayCount = validRange ? diffDays(periodStart, periodEnd) + 1 : 0

  // Cảnh báo kỳ chồng / hở so với tuần trước & tuần sau
  const warnings = useMemo(() => {
    const list: string[] = []
    if (!validRange) return list

    if (prevWeek) {
      const gap = diffDays(prevWeek.periodEnd, periodStart)
      if (gap <= 0) {
        const overlapDays = Math.abs(gap) + 1
        list.push(
          `Chồng ${overlapDays} ngày với tuần trước (${formatDMY(prevWeek.periodStart)}–${formatDMY(prevWeek.periodEnd)}). Ngày bắt đầu liền kề nên là ${formatDMY(addDays(prevWeek.periodEnd, 1))}.`,
        )
      } else if (gap > 1) {
        const missingDays = gap - 1
        list.push(
          `Hở ${missingDays} ngày so với tuần trước (kỳ tuần trước kết thúc ${formatDMY(prevWeek.periodEnd)}). Nếu tuần trước họp sớm, kỳ tuần này thường bắt đầu từ ${formatDMY(addDays(prevWeek.periodEnd, 1))}.`,
        )
      }
    }

    if (nextWeek) {
      const nextGap = diffDays(periodEnd, nextWeek.periodStart)
      if (nextGap <= 0) {
        const overlapDays = Math.abs(nextGap) + 1
        list.push(
          `Chồng ${overlapDays} ngày với tuần kế tiếp đã lưu (${formatDMY(nextWeek.periodStart)}–${formatDMY(nextWeek.periodEnd)}).`,
        )
      } else if (nextGap > 1) {
        const missingDays = nextGap - 1
        list.push(
          `Hở ${missingDays} ngày trước tuần kế tiếp (${formatDMY(nextWeek.periodStart)}). Tuần kế tiếp có thể cần cập nhật lại ngày bắt đầu.`,
        )
      }
    }

    return list
  }, [validRange, prevWeek, nextWeek, periodStart, periodEnd])

  const handleEarlyHolidayPreset = () => {
    const chosen = actualMeetingDate || addDays(report.meetingDate, -1)
    setActualMeetingDate(chosen)
    setPeriodEnd(chosen)
    if (prevWeek) {
      const suggestedStart = addDays(prevWeek.periodEnd, 1)
      if (diffDays(suggestedStart, chosen) >= 0) {
        setPeriodStart(suggestedStart)
      }
    }
    setPeriodOverridden(true)
    if (!periodNote.trim()) {
      setPeriodNote('Họp sớm trước kỳ nghỉ')
    }
  }

  const handleResetDefault = () => {
    const def = defaultPeriod(report.meetingDate)
    const start =
      prevWeek && prevWeek.id === addDays(report.id, -7)
        ? addDays(prevWeek.periodEnd, 1)
        : def.periodStart
    setActualMeetingDate('')
    setPeriodStart(diffDays(start, def.periodEnd) >= 0 ? start : def.periodEnd)
    setPeriodEnd(def.periodEnd)
    setPeriodOverridden(false)
    setPeriodNote('')
    setReportMonthOverridden(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validRange) {
      setError('Ngày bắt đầu kỳ không được sau ngày kết thúc kỳ.')
      return
    }
    setSaving(true)
    try {
      const resolvedMonth = reportMonthOverridden ? manualMonth : autoMonth
      await onSave({
        actualMeetingDate: actualMeetingDate.trim() ? actualMeetingDate.trim() : null,
        periodStart,
        periodEnd,
        periodOverridden,
        periodNote: periodNote.trim(),
        reportMonth: resolvedMonth,
        reportMonthOverridden,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được thông tin kỳ tuần.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Chỉnh kỳ / tuần đặc biệt"
      className="sm:max-w-xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] sm:min-h-[32px] text-sm"
          >
            Huỷ
          </Button>
          <Button
            type="submit"
            form="period-edit-form"
            disabled={saving || !validRange}
            className="min-h-[44px] sm:min-h-[32px] bg-blue-600 hover:bg-blue-700 text-sm text-white"
          >
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </div>
      }
    >
      <form id="period-edit-form" onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-slate-700">
          <p className="font-medium text-slate-900">
            Tuần giao ban danh nghĩa: Thứ 6 ngày {formatDMY(report.meetingDate)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            Dùng khi họp dời ngày (nghỉ lễ, Tết) hoặc cần gán tuần giáp ranh sang tháng khác.
          </p>
        </div>

        {/* Nút gợi ý nhanh */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEarlyHolidayPreset}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <CalendarCheck2 className="h-4 w-4 shrink-0" />
            <span>Họp sớm trước kỳ nghỉ</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span>Mặc định</span>
          </button>
        </div>

        {/* Ngày họp thực tế */}
        <div className="space-y-1.5">
          <label htmlFor="period-actual-date" className="block font-medium text-slate-900">
            Ngày họp thực tế (để trống nếu họp đúng {formatDMY(report.meetingDate)})
          </label>
          <input
            id="period-actual-date"
            type="date"
            value={actualMeetingDate}
            onChange={(e) => setActualMeetingDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 min-h-[44px] sm:min-h-[32px] text-sm"
          />
        </div>

        {/* Khoảng kỳ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="period-start" className="block font-medium text-slate-900">
              Từ ngày (periodStart)
            </label>
            <input
              id="period-start"
              type="date"
              required
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value)
                setPeriodOverridden(true)
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 min-h-[44px] sm:min-h-[32px] text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="period-end" className="block font-medium text-slate-900">
              Đến hết ngày (periodEnd)
            </label>
            <input
              id="period-end"
              type="date"
              required
              value={periodEnd}
              onChange={(e) => {
                setPeriodEnd(e.target.value)
                setPeriodOverridden(true)
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 min-h-[44px] sm:min-h-[32px] text-sm"
            />
          </div>
        </div>

        <div className="text-xs text-slate-600">
          {validRange ? (
            <span>
              Kỳ đã chọn gồm <strong>{dayCount} ngày</strong> ({formatDMY(periodStart)} → {formatDMY(periodEnd)}).
              {periodOverridden && ' Đã đánh dấu kỳ chỉnh tay.'}
            </span>
          ) : (
            <span className="font-semibold text-red-700">
              Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
            </span>
          )}
        </div>

        {/* Cảnh báo chồng / hở kỳ */}
        {warnings.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1.5 text-sm text-amber-950"
          >
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span>Cảnh báo lệch kỳ so với tuần lân cận</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Ghi chú kỳ */}
        <div className="space-y-1.5">
          <label htmlFor="period-note" className="block font-medium text-slate-900">
            Ghi chú kỳ đặc biệt
          </label>
          <input
            id="period-note"
            type="text"
            value={periodNote}
            onChange={(e) => setPeriodNote(e.target.value)}
            placeholder="Ví dụ: Họp sớm trước nghỉ Tết"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 min-h-[44px] sm:min-h-[32px] text-sm"
          />
        </div>

        {/* Tháng báo cáo */}
        <div className="rounded-lg border border-slate-200 p-3 space-y-2.5">
          <div className="font-medium text-slate-900">Tháng báo cáo</div>
          <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px] sm:min-h-[32px]">
            <input
              type="radio"
              name="reportMonthMode"
              checked={!reportMonthOverridden}
              onChange={() => setReportMonthOverridden(false)}
              className="h-4 w-4 text-blue-600"
            />
            <span>
              Tự động theo đa số ngày → <strong>tháng {formatYearMonthVN(autoMonth)}</strong>
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px] sm:min-h-[32px]">
            <input
              type="radio"
              name="reportMonthMode"
              checked={reportMonthOverridden}
              onChange={() => {
                setReportMonthOverridden(true)
                if (!manualMonth) setManualMonth(autoMonth)
              }}
              className="h-4 w-4 text-blue-600"
            />
            <span>Ghi đè thủ công</span>
          </label>

          {reportMonthOverridden && (
            <div className="pl-6">
              <input
                type="month"
                value={manualMonth}
                onChange={(e) => setManualMonth(e.target.value)}
                aria-label="Chọn tháng báo cáo ghi đè"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 min-h-[44px] sm:min-h-[32px] text-sm"
              />
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            {error}
          </div>
        )}
      </form>
    </ResponsiveModal>
  )
}
