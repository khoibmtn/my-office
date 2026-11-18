/**
 * Weekly report period rules — pure functions, no firebase.
 * All dates are Vietnam-local 'YYYY-MM-DD' strings handled with UTC day arithmetic,
 * so results are identical under any process timezone.
 * See docs/WEEKLY_REPORT_PLAN.md §4 and §15 (Q1).
 */
import type { ISODate, WeekPeriod, WeekPeriodInfo, YearMonth } from '@/types/weekly-report'

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000

function toUtcMs(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

function fromUtcMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Current calendar date in Vietnam (UTC+7). */
export function todayVN(now: Date = new Date()): ISODate {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS)
}

/** b - a in days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS)
}

/** 0 = Sunday … 5 = Friday, 6 = Saturday. */
export function dayOfWeek(d: ISODate): number {
  return new Date(toUtcMs(d)).getUTCDay()
}

export function formatDMY(d: ISODate): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function formatDM(d: ISODate): string {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

/** Nearest Friday strictly AFTER d (a Friday maps to the next Friday). */
export function defaultMeetingDateFor(d: ISODate): ISODate {
  let delta = (5 - dayOfWeek(d) + 7) % 7
  if (delta === 0) delta = 7
  return addDays(d, delta)
}

function makePeriod(weekId: string, meetingDate: ISODate, start: ISODate, end: ISODate): WeekPeriod {
  return { weekId, meetingDate, periodStart: start, periodEnd: end, dayCount: diffDays(start, end) + 1 }
}

export function defaultPeriod(meetingDate: ISODate): WeekPeriod {
  return makePeriod(meetingDate, meetingDate, addDays(meetingDate, -7), addDays(meetingDate, -1))
}

function periodOfSaved(w: WeekPeriodInfo): WeekPeriod {
  return makePeriod(w.id, w.meetingDate, w.periodStart, w.periodEnd)
}

/**
 * Saved week -> its stored period. Unsaved -> default period, but the start is pushed
 * after the previous saved week's periodEnd (so a week following an early/short one
 * continues seamlessly and may be longer than 7 days).
 */
export function resolvePeriod(weekId: string, weeks: WeekPeriodInfo[] = []): WeekPeriod {
  const saved = weeks.find((w) => w.id === weekId)
  if (saved) return periodOfSaved(saved)
  const base = defaultPeriod(weekId)
  let prev: WeekPeriodInfo | null = null
  for (const w of weeks) {
    if (w.id < weekId && (!prev || w.id > prev.id)) prev = w
  }
  if (!prev) return base
  let start = addDays(prev.periodEnd, 1)
  // Directly following week: stitch seamlessly (may be shorter or longer than 7 days).
  // Otherwise (gap of weeks): start = max(meeting-7, prevEnd+1).
  const adjacent = prev.id === addDays(weekId, -7)
  if (!adjacent && diffDays(start, base.periodStart) > 0) start = base.periodStart
  if (diffDays(start, base.periodEnd) < 0) start = base.periodEnd // never inverted
  return makePeriod(weekId, weekId, start, base.periodEnd)
}

/** Saved period containing d wins; else nearest Friday after d, skipping weeks already closed before d. */
export function weekIdForDate(d: ISODate, weeks: WeekPeriodInfo[] = []): string {
  for (const w of weeks) {
    if (d >= w.periodStart && d <= w.periodEnd) return w.id
  }
  let id = defaultMeetingDateFor(d)
  for (let guard = 0; guard < 60; guard++) {
    const saved = weeks.find((w) => w.id === id)
    if (saved && saved.periodEnd < d) id = addDays(id, 7)
    else break
  }
  return id
}

/** Friday -> today's own week (for reading the meeting); other days -> upcoming Friday's week. */
export function currentWeekId(today: ISODate, weeks: WeekPeriodInfo[] = []): string {
  if (dayOfWeek(today) === 5) return today
  return weekIdForDate(today, weeks)
}

/** Month holding the majority of the period's days; tie -> month of periodEnd. */
export function reportMonthFor(periodStart: ISODate, periodEnd: ISODate): YearMonth {
  const counts = new Map<YearMonth, number>()
  const n = diffDays(periodStart, periodEnd)
  for (let i = 0; i <= n; i++) {
    const m = addDays(periodStart, i).slice(0, 7)
    counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  const endMonth = periodEnd.slice(0, 7)
  let best = endMonth
  let bestCount = counts.get(endMonth) ?? 0
  for (const [m, c] of counts) {
    if (c > bestCount) {
      best = m
      bestCount = c
    }
  }
  return best
}

export function isBoundaryWeek(p: WeekPeriod): boolean {
  return p.periodStart.slice(0, 7) !== p.periodEnd.slice(0, 7)
}

/**
 * All weeks (saved or virtual default) whose report month is `month`, honoring
 * saved reportMonth overrides. Sorted by meetingDate.
 */
export function weeksOfMonth(month: YearMonth, weeks: WeekPeriodInfo[] = []): WeekPeriod[] {
  const result: WeekPeriod[] = []
  const savedIds = new Set(weeks.map((w) => w.id))

  for (const w of weeks) {
    const m = w.reportMonthOverridden ? w.reportMonth : reportMonthFor(w.periodStart, w.periodEnd)
    if (m === month) result.push(periodOfSaved(w))
  }

  // Virtual weeks: every Friday within a window around the month.
  const first = `${month}-01`
  let friday = defaultMeetingDateFor(addDays(first, -22)) // a Friday well before the month
  const last = addDays(first, 31 + 14)
  while (friday <= last) {
    if (!savedIds.has(friday)) {
      const p = resolvePeriod(friday, weeks)
      if (reportMonthFor(p.periodStart, p.periodEnd) === month) result.push(p)
    }
    friday = addDays(friday, 7)
  }

  return result.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
}
