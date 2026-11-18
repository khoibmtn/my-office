'use client'

import React from 'react'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MoreHorizontal,
  Settings,
} from 'lucide-react'
import { addDays, formatDM, formatDMY } from '@/lib/weekly-report/period'
import type { WeekPeriodInfo, WeeklyReport, YearMonth } from '@/types/weekly-report'
import { WeekPicker } from './WeekPicker'

const iconNav =
  'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors'

export type SaveIndicatorStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface WeekHeaderProps {
  report: WeeklyReport
  saveStatus: SaveIndicatorStatus
  lastSavedAt: Date | null
  saveErrorMessage?: string | null
  onRetrySave?: () => void
  onOpenPeriodDialog: () => void
  onOpenReadView?: () => void
  isPreview?: boolean
  currentWeekHref?: string
  /** Saved weeks (for special periods in the picker) */
  weeks?: WeekPeriodInfo[]
  onSelectWeek?: (weekId: string) => void
}

function formatMonthLabel(month: YearMonth): string {
  const [y, m] = month.split('-')
  return y && m ? `${m}/${y}` : month
}

function formatSavedTime(d: Date | null): string {
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(d)
  } catch {
    return ''
  }
}

export function WeekHeader({
  report,
  saveStatus,
  lastSavedAt,
  saveErrorMessage,
  onRetrySave,
  onOpenPeriodDialog,
  onOpenReadView,
  isPreview = false,
  currentWeekHref,
  weeks = [],
  onSelectWeek,
}: WeekHeaderProps) {
  const prevWeekId = addDays(report.id, -7)
  const nextWeekId = addDays(report.id, 7)
  const displayMeetingDate = formatDMY(report.actualMeetingDate || report.meetingDate)
  const periodLabel = `${formatDM(report.periodStart)}–${formatDM(report.periodEnd)}`
  const monthLabel = formatMonthLabel(report.reportMonth)

  return (
    <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Điều hướng tuần: ‹ [lịch chọn tuần] › */}
        <div className="flex items-center gap-1.5">
          {isPreview ? (
            <span aria-disabled className={`${iconNav} opacity-40`} title="Tuần trước"><ChevronLeft className="h-4 w-4" /></span>
          ) : (
            <Link href={`/weekly-reports/${prevWeekId}`} className={iconNav} aria-label="Tuần trước" title="Tuần trước">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
          <WeekPicker
            weekId={report.id}
            weeks={weeks}
            onSelect={onSelectWeek}
            label={`Tuần giao ban ${formatDMY(report.meetingDate)}`}
          />
          {isPreview ? (
            <span aria-disabled className={`${iconNav} opacity-40`} title="Tuần sau"><ChevronRight className="h-4 w-4" /></span>
          ) : (
            <Link href={`/weekly-reports/${nextWeekId}`} className={iconNav} aria-label="Tuần sau" title="Tuần sau">
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Trạng thái lưu */}
        <div className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
          {saveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang lưu…</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              <Check className="h-4 w-4" />
              <span>Đã lưu {formatSavedTime(lastSavedAt)}</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <button
              type="button"
              onClick={onRetrySave}
              title={saveErrorMessage || 'Lỗi lưu dữ liệu, bấm để thử lại'}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 border border-red-300 px-3 py-1.5 min-h-[44px] sm:min-h-[32px] font-semibold text-red-800 hover:bg-red-200 transition-colors"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Lỗi lưu, thử lại</span>
            </button>
          )}
          {saveStatus === 'idle' && report.status === 'finalized' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
              <Check className="h-4 w-4" />
              <span>Đã chốt tuần</span>
            </span>
          )}
        </div>
      </div>

      {/* Tiêu đề kỳ tuần & nút hành động */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="space-y-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
            Giao ban {displayMeetingDate}
            <span className="font-normal text-slate-400"> · </span>
            <span className="font-semibold text-slate-800">kỳ {periodLabel}</span>
            <span className="font-normal text-slate-400"> · </span>
            <span className="font-medium text-slate-700">thuộc tháng {monthLabel}</span>
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {report.status === 'finalized' ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">
                Đã chốt
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-700">
                Đang soạn
              </span>
            )}
            {report.actualMeetingDate && report.actualMeetingDate !== report.meetingDate && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-900">
                Dời ngày họp (danh nghĩa {formatDMY(report.meetingDate)})
              </span>
            )}
            {report.periodOverridden && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-900">
                Tuần đặc biệt
              </span>
            )}
            {report.reportMonthOverridden && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
                Ghi đè tháng báo cáo
              </span>
            )}
            {report.periodNote && (
              <span className="text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                {report.periodNote}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenReadView ? (
            <button
              type="button"
              onClick={onOpenReadView}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 min-h-[44px] text-base font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>Bản đọc giao ban</span>
            </button>
          ) : (
            <Link
              href={`/weekly-reports/${report.id}/read`}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 min-h-[44px] text-base font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>Bản đọc giao ban</span>
            </Link>
          )}

          {!isPreview && (
            <Link
              href={`/weekly-reports/monthly/${report.reportMonth}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 min-h-[44px] text-base font-medium text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <CalendarRange className="h-4 w-4 text-blue-600" />
              <span>Tổng hợp tháng</span>
            </Link>
          )}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Tuỳ chọn tuần giao ban"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white min-h-[44px] min-w-[44px] px-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[230px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-base"
              >
                <DropdownMenu.Item
                  onSelect={onOpenPeriodDialog}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-[44px] text-slate-800 outline-none hover:bg-slate-100 focus:bg-slate-100"
                >
                  <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Chỉnh kỳ / tuần đặc biệt</span>
                </DropdownMenu.Item>

                {!isPreview && (
                  <>
                    {currentWeekHref && (
                      <DropdownMenu.Item asChild>
                        <Link
                          href={currentWeekHref}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-[44px] text-slate-800 outline-none hover:bg-slate-100 focus:bg-slate-100"
                        >
                          <CalendarRange className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Về tuần hiện tại</span>
                        </Link>
                      </DropdownMenu.Item>
                    )}

                    <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />

                    <DropdownMenu.Item asChild>
                      <Link
                        href="/weekly-reports/advisory"
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-[44px] text-slate-800 outline-none hover:bg-slate-100 focus:bg-slate-100"
                      >
                        <FileText className="h-4 w-4 text-slate-600 shrink-0" />
                        <span>Sổ văn bản tham mưu</span>
                      </Link>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item asChild>
                      <Link
                        href="/settings/weekly-report"
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-[44px] text-slate-800 outline-none hover:bg-slate-100 focus:bg-slate-100"
                      >
                        <Settings className="h-4 w-4 text-slate-600 shrink-0" />
                        <span>Cài đặt giao ban</span>
                      </Link>
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  )
}
