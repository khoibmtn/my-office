'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  dayOfWeek,
  formatDM,
  formatDMY,
  resolvePeriod,
  todayVN,
  weekIdForDate,
} from '@/lib/weekly-report/period'
import type { ISODate, WeekPeriodInfo } from '@/types/weekly-report'

type View = 'day' | 'month' | 'year'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number): ISODate => `${y}-${pad(m)}-${pad(d)}`
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

export interface WeekPickerProps {
  weekId: string
  weeks: WeekPeriodInfo[]
  /** Called with the weekId whose period contains the picked day. */
  onSelect?: (weekId: string) => void
  label: string
}

/**
 * Calendar-style week picker: day grid (click any day → the briefing week containing it),
 * click the month title → month grid, click the year → year grid (year → month → day).
 */
export function WeekPicker({ weekId, weeks, onSelect, label }: WeekPickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('day')
  const current = useMemo(() => resolvePeriod(weekId, weeks), [weekId, weeks])
  const [cursorY, setCursorY] = useState(() => Number(current.periodEnd.slice(0, 4)))
  const [cursorM, setCursorM] = useState(() => Number(current.periodEnd.slice(5, 7)))
  const [hoverDay, setHoverDay] = useState<ISODate | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const today = todayVN()
  const storedIds = useMemo(() => new Set(weeks.map((w) => w.id)), [weeks])

  // Reset to the current week's month whenever the picker opens
  useEffect(() => {
    if (!open) return
    setView('day')
    setCursorY(Number(current.periodEnd.slice(0, 4)))
    setCursorM(Number(current.periodEnd.slice(5, 7)))
  }, [open, current.periodEnd])

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hoverPeriod = useMemo(
    () => (hoverDay ? resolvePeriod(weekIdForDate(hoverDay, weeks), weeks) : null),
    [hoverDay, weeks],
  )

  const shiftMonth = (delta: number) => {
    let m = cursorM + delta
    let y = cursorY
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setCursorM(m)
    setCursorY(y)
  }

  const pickDay = (d: ISODate) => {
    setOpen(false)
    onSelect?.(weekIdForDate(d, weeks))
  }

  // Day grid, Monday first
  const cells = useMemo(() => {
    const first = iso(cursorY, cursorM, 1)
    const lead = (dayOfWeek(first) + 6) % 7
    const start = addDays(first, -lead)
    const total = Math.ceil((lead + daysInMonth(cursorY, cursorM)) / 7) * 7
    return Array.from({ length: total }, (_, i) => addDays(start, i))
  }, [cursorY, cursorM])

  const yearStart = Math.floor(cursorY / 12) * 12

  const navBtn =
    'inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[32px] sm:min-w-[32px] text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  const titleBtn =
    'inline-flex items-center rounded-md px-2 min-h-[44px] sm:min-h-[32px] text-sm font-semibold text-slate-900 hover:bg-slate-100'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <CalendarDays className="h-4 w-4 text-slate-500" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chọn tuần giao ban"
          className="absolute left-0 z-40 mt-2 w-[min(92vw,340px)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-1 pb-2">
            <button
              type="button"
              className={navBtn}
              aria-label={view === 'day' ? 'Tháng trước' : view === 'month' ? 'Năm trước' : '12 năm trước'}
              onClick={() => (view === 'day' ? shiftMonth(-1) : setCursorY((y) => y - (view === 'month' ? 1 : 12)))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {view === 'day' && (
                <button type="button" className={titleBtn} onClick={() => setView('month')}>
                  Tháng {cursorM}
                </button>
              )}
              {view !== 'year' ? (
                <button type="button" className={titleBtn} onClick={() => setView('year')}>
                  {cursorY}
                </button>
              ) : (
                <span className="px-2 text-sm font-semibold text-slate-900">
                  {yearStart}–{yearStart + 11}
                </span>
              )}
            </div>
            <button
              type="button"
              className={navBtn}
              aria-label={view === 'day' ? 'Tháng sau' : view === 'month' ? 'Năm sau' : '12 năm sau'}
              onClick={() => (view === 'day' ? shiftMonth(1) : setCursorY((y) => y + (view === 'month' ? 1 : 12)))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {view === 'day' && (
            <>
              <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHoverDay(null)}>
                {cells.map((d) => {
                  const inMonth = Number(d.slice(5, 7)) === cursorM
                  const inCurrent = d >= current.periodStart && d <= current.periodEnd
                  const inHover = !!hoverPeriod && d >= hoverPeriod.periodStart && d <= hoverPeriod.periodEnd
                  const isMeeting = dayOfWeek(d) === 5 && storedIds.has(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pickDay(d)}
                      onMouseEnter={() => setHoverDay(d)}
                      onFocus={() => setHoverDay(d)}
                      aria-label={`Ngày ${formatDMY(d)}`}
                      className={[
                        'relative h-10 sm:h-8 text-sm tabular-nums transition-colors',
                        inCurrent ? 'bg-blue-600 text-white font-semibold' : inHover ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100',
                        !inCurrent && !inMonth ? 'text-slate-400' : '',
                        !inCurrent && !inHover && inMonth ? 'text-slate-800' : '',
                        d === today && !inCurrent ? 'ring-1 ring-inset ring-blue-500 rounded-md' : '',
                      ].join(' ')}
                    >
                      {Number(d.slice(8, 10))}
                      {isMeeting && (
                        <span
                          aria-hidden
                          className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${inCurrent ? 'bg-white' : 'bg-emerald-500'}`}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 min-h-[2.5rem] text-xs text-slate-600">
                {hoverPeriod
                  ? `Kỳ ${formatDM(hoverPeriod.periodStart)}–${formatDM(hoverPeriod.periodEnd)} → giao ban ${formatDMY(hoverPeriod.weekId)}`
                  : `Đang xem kỳ ${formatDM(current.periodStart)}–${formatDM(current.periodEnd)}. Chấm xanh: tuần đã có báo cáo.`}
              </p>
              <button
                type="button"
                onClick={() => pickDay(today)}
                className="mt-1 w-full rounded-md border border-slate-200 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Tuần hiện tại
              </button>
            </>
          )}

          {view === 'month' && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setCursorM(m); setView('day') }}
                  className={`min-h-[44px] sm:min-h-[32px] rounded-md text-sm ${
                    m === cursorM ? 'bg-blue-600 text-white font-semibold' : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Tháng {m}
                </button>
              ))}
            </div>
          )}

          {view === 'year' && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => { setCursorY(y); setView('month') }}
                  className={`min-h-[44px] sm:min-h-[32px] rounded-md text-sm tabular-nums ${
                    y === cursorY ? 'bg-blue-600 text-white font-semibold' : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
