/**
 * Pure recurrence occurrence generator.
 * ZERO dependencies — unit-testable, portable.
 *
 * Generates occurrence dates within a [windowStart, windowEnd] range
 * based on a RecurrenceRule.
 */

import type { RecurrenceRule, MisfirePolicy } from './types'

const MAX_OCCURRENCES = 1000 // Safety cap
const DAY_MS = 86400000

/**
 * Normalize misfirePolicy from possible legacy lowercase values
 * ('create_missed' | 'skip_missed') to canonical uppercase ('CREATE_MISSED' | 'SKIP_MISSED').
 */
export function normalizeMisfirePolicy(policy?: string | null): MisfirePolicy {
  if (!policy) return 'CREATE_MISSED'
  const normalized = String(policy).trim().toUpperCase()
  if (normalized === 'SKIP_MISSED') return 'SKIP_MISSED'
  return 'CREATE_MISSED'
}

function getTimezoneOffsetMs(utcMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs))

  const y = Number(parts.find(p => p.type === 'year')?.value ?? 0)
  const m = Number(parts.find(p => p.type === 'month')?.value ?? 1)
  const d = Number(parts.find(p => p.type === 'day')?.value ?? 1)
  const rawHour = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const h = rawHour === 24 ? 0 : rawHour
  const min = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  const s = Number(parts.find(p => p.type === 'second')?.value ?? 0)

  const wallAsUtcMs = Date.UTC(y, m - 1, d, h, min, s, 0)
  const truncatedUtcMs = Math.floor(utcMs / 1000) * 1000
  return wallAsUtcMs - truncatedUtcMs
}

/**
 * Get the exact instant corresponding to 00:00:00.000 of "today" in the given IANA timezone
 * (e.g. Asia/Ho_Chi_Minh -> 17:00:00.000Z of the previous UTC calendar day).
 */
export function getStartOfTodayInTimezone(
  now: Date = new Date(),
  timezone: string = 'Asia/Ho_Chi_Minh'
): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const year = Number(parts.find(p => p.type === 'year')?.value ?? now.getUTCFullYear())
    const month = Number(parts.find(p => p.type === 'month')?.value ?? (now.getUTCMonth() + 1))
    const day = Number(parts.find(p => p.type === 'day')?.value ?? now.getUTCDate())

    const midnightWallUtcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    const firstOffset = getTimezoneOffsetMs(midnightWallUtcGuess, timezone)
    const candidateMs = midnightWallUtcGuess - firstOffset
    const secondOffset = getTimezoneOffsetMs(candidateMs, timezone)
    return new Date(midnightWallUtcGuess - secondOffset)
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  }
}

/**
 * Resolve the effective windowStart for occurrence generation, applying misfirePolicy.
 * When SKIP_MISSED: windowStart = max(lastGenerated + 1 day (or startDate), today 00:00 Asia/Ho_Chi_Minh).
 * When CREATE_MISSED: windowStart = lastGenerated + 1 day (or startDate, or now).
 */
export function resolveWindowStart(params: {
  lastGeneratedDate?: Date | null
  startDate?: Date | null
  misfirePolicy?: string | null
  now?: Date
  timezone?: string
}): Date {
  const now = params.now ?? new Date()
  const tz = params.timezone || 'Asia/Ho_Chi_Minh'
  const policy = normalizeMisfirePolicy(params.misfirePolicy)

  let baseStart: Date
  if (params.lastGeneratedDate) {
    baseStart = new Date(params.lastGeneratedDate.getTime() + DAY_MS)
  } else if (params.startDate) {
    baseStart = new Date(params.startDate.getTime())
  } else {
    baseStart = new Date(now.getTime())
  }

  if (policy === 'SKIP_MISSED') {
    const todayStart = getStartOfTodayInTimezone(now, tz)
    return baseStart.getTime() > todayStart.getTime() ? baseStart : todayStart
  }

  return baseStart
}

/**
 * Resolve the last day of a given month.
 * Handles leap years correctly.
 */
export function resolveLastDay(year: number, month: number): number {
  // month is 1-indexed; Date constructor with day=0 gives last day of prev month
  return new Date(year, month, 0).getDate()
}

/**
 * Generate occurrence dates within [windowStart, windowEnd].
 * Returns dates in chronological order.
 *
 * Algorithm:
 *   1. Start from anchorDate
 *   2. Step through intervals
 *   3. For each step, expand by byWeekday/byMonthDay/byMonth
 *   4. Filter to [windowStart, windowEnd]
 *   5. Cap at MAX_OCCURRENCES
 */
export interface GenerateOccurrencesOptions {
  misfirePolicy?: MisfirePolicy | 'create_missed' | 'skip_missed' | string | null
  now?: Date
}

export function generateOccurrences(
  rule: RecurrenceRule,
  windowStart: Date,
  windowEnd: Date,
  options?: GenerateOccurrencesOptions
): Date[] {
  let effectiveStart = windowStart
  if (options?.misfirePolicy && normalizeMisfirePolicy(options.misfirePolicy) === 'SKIP_MISSED') {
    const todayStart = getStartOfTodayInTimezone(
      options.now ?? new Date(),
      rule.timezone || 'Asia/Ho_Chi_Minh'
    )
    if (todayStart.getTime() > effectiveStart.getTime()) {
      effectiveStart = todayStart
    }
  }

  if (windowEnd < effectiveStart) return []

  const anchor = new Date(rule.anchorDate)

  switch (rule.frequency) {
    case 'daily':
      return generateDaily(rule, anchor, effectiveStart, windowEnd)
    case 'weekly':
      return generateWeekly(rule, anchor, effectiveStart, windowEnd)
    case 'monthly':
      return generateMonthly(rule, anchor, effectiveStart, windowEnd)
    case 'yearly':
      return generateYearly(rule, anchor, effectiveStart, windowEnd)
    default:
      return []
  }
}

// ===== Daily =====

function generateDaily(
  rule: RecurrenceRule,
  anchor: Date,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const results: Date[] = []
  const interval = rule.interval || 1
  const anchorMs = anchor.getTime()
  const dayMs = 86400000

  // Find the first occurrence >= windowStart
  let diffDays = Math.max(0, Math.floor((windowStart.getTime() - anchorMs) / dayMs))
  // Align to interval
  const remainder = diffDays % interval
  if (remainder !== 0) diffDays += interval - remainder

  let current = new Date(anchorMs + diffDays * dayMs)

  while (current <= windowEnd && results.length < MAX_OCCURRENCES) {
    if (current >= windowStart && current >= anchor) {
      results.push(new Date(current))
    }
    current = new Date(current.getTime() + interval * dayMs)
  }

  return results
}

// ===== Weekly =====

function generateWeekly(
  rule: RecurrenceRule,
  anchor: Date,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const results: Date[] = []
  const interval = rule.interval || 1
  const weekdays = rule.byWeekday ?? [isoWeekday(anchor)]

  // Start from the week of the anchor
  // Find the Monday of anchor's week
  const anchorMonday = getMonday(anchor)
  const weekMs = 7 * 86400000

  // Calculate which week number to start from
  const diffWeeks = Math.max(0, Math.floor((windowStart.getTime() - anchorMonday.getTime()) / weekMs))
  const startWeekNum = Math.floor(diffWeeks / interval) * interval

  let weekStart = new Date(anchorMonday.getTime() + startWeekNum * weekMs)

  while (weekStart.getTime() <= windowEnd.getTime() + weekMs && results.length < MAX_OCCURRENCES) {
    // Check each target weekday in this week
    for (const wd of weekdays) {
      // wd is ISO: 1=Mon, 7=Sun → offset from Monday = wd - 1
      const date = new Date(weekStart.getTime() + (wd - 1) * 86400000)
      if (date >= windowStart && date <= windowEnd && date >= anchor) {
        results.push(new Date(date))
      }
    }
    weekStart = new Date(weekStart.getTime() + interval * weekMs)
  }

  results.sort((a, b) => a.getTime() - b.getTime())
  return results
}

function isoWeekday(d: Date): number {
  // JS: 0=Sun, 1=Mon... → ISO: 1=Mon, 7=Sun
  return d.getDay() === 0 ? 7 : d.getDay()
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Resolve the day of month matching an ordinal weekday (bySetPos).
 * e.g. first Monday (byWeekday: 1, bySetPos: 1), last Friday (byWeekday: 5, bySetPos: -1).
 * month is 1-indexed (1..12).
 */
export function resolveBySetPos(
  year: number,
  month: number,
  targetWeekday: number,
  setPos: number
): number {
  const daysInMonth = resolveLastDay(year, month)
  const matchingDays: number[] = []

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day)
    const jsDay = d.getDay()
    const isoDay = jsDay === 0 ? 7 : jsDay
    if (isoDay === targetWeekday) {
      matchingDays.push(day)
    }
  }

  if (matchingDays.length === 0) return 1
  if (setPos > 0) {
    const idx = Math.min(setPos - 1, matchingDays.length - 1)
    return matchingDays[idx]
  } else {
    const idx = Math.max(0, matchingDays.length + setPos)
    return matchingDays[idx]
  }
}

/**
 * Apply weekend adjustment policy (shift to Friday or Monday if on Saturday/Sunday).
 */
export function applyWeekendPolicy(
  date: Date,
  policy?: 'exact' | 'shift_friday' | 'shift_monday'
): Date {
  if (!policy || policy === 'exact') return date
  const day = date.getDay() // 0 = Sun, 6 = Sat
  if (day !== 0 && day !== 6) return date

  const adjusted = new Date(date)
  if (policy === 'shift_friday') {
    const offset = day === 6 ? -1 : -2
    adjusted.setDate(adjusted.getDate() + offset)
  } else if (policy === 'shift_monday') {
    const offset = day === 6 ? 2 : 1
    adjusted.setDate(adjusted.getDate() + offset)
  }
  return adjusted
}

// ===== Monthly =====

function generateMonthly(
  rule: RecurrenceRule,
  anchor: Date,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const results: Date[] = []
  const interval = rule.interval || 1
  const monthDays = rule.byMonthDay ?? [anchor.getDate()]

  // Start from anchor's month, step by interval
  let year = anchor.getFullYear()
  let month = anchor.getMonth() // 0-indexed

  // Fast-forward to near windowStart
  if (windowStart > anchor) {
    const diffMonths = (windowStart.getFullYear() - year) * 12 + (windowStart.getMonth() - month)
    const skipIntervals = Math.floor(diffMonths / interval)
    const skip = skipIntervals * interval
    month += skip
    year += Math.floor(month / 12)
    month = month % 12
  }

  while (results.length < MAX_OCCURRENCES) {
    // Check if bySetPos with byWeekday is specified
    if (rule.bySetPos !== undefined && rule.byWeekday && rule.byWeekday.length > 0) {
      for (const wd of rule.byWeekday) {
        const resolvedDay = resolveBySetPos(year, month + 1, wd, rule.bySetPos)
        let date = new Date(year, month, resolvedDay)
        date = applyWeekendPolicy(date, rule.weekendPolicy)

        if (date > windowEnd) return results
        if (date >= windowStart && date >= anchor) {
          results.push(date)
        }
      }
    } else {
      for (const day of monthDays) {
        const resolvedDay = day === -1
          ? resolveLastDay(year, month + 1)
          : Math.min(day, resolveLastDay(year, month + 1))

        let date = new Date(year, month, resolvedDay)
        date = applyWeekendPolicy(date, rule.weekendPolicy)

        if (date > windowEnd) return results
        if (date >= windowStart && date >= anchor) {
          results.push(date)
        }
      }
    }

    month += interval
    while (month >= 12) {
      month -= 12
      year++
    }

    // Safety: if we're way past windowEnd
    if (new Date(year, month, 1) > windowEnd) break
  }

  return results
}

// ===== Yearly =====

function generateYearly(
  rule: RecurrenceRule,
  anchor: Date,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const results: Date[] = []
  const interval = rule.interval || 1
  const months = rule.byMonth ?? [anchor.getMonth() + 1] // 1-indexed
  const days = rule.byMonthDay ?? [anchor.getDate()]

  let year = anchor.getFullYear()

  // Fast-forward
  if (windowStart > anchor) {
    const diffYears = windowStart.getFullYear() - year
    const skipIntervals = Math.floor(diffYears / interval)
    year += skipIntervals * interval
  }

  while (results.length < MAX_OCCURRENCES) {
    for (const m of months) {
      if (rule.bySetPos !== undefined && rule.byWeekday && rule.byWeekday.length > 0) {
        for (const wd of rule.byWeekday) {
          const resolvedDay = resolveBySetPos(year, m, wd, rule.bySetPos)
          let date = new Date(year, m - 1, resolvedDay)
          date = applyWeekendPolicy(date, rule.weekendPolicy)

          if (date > windowEnd) return results
          if (date >= windowStart && date >= anchor) {
            results.push(date)
          }
        }
      } else {
        for (const d of days) {
          const resolvedDay = d === -1
            ? resolveLastDay(year, m)
            : Math.min(d, resolveLastDay(year, m))

          let date = new Date(year, m - 1, resolvedDay)
          date = applyWeekendPolicy(date, rule.weekendPolicy)

          if (date > windowEnd) return results
          if (date >= windowStart && date >= anchor) {
            results.push(date)
          }
        }
      }
    }

    year += interval
    if (year > windowEnd.getFullYear() + 1) break
  }

  return results
}

/**
 * Generate a deterministic document ID for an occurrence.
 * Format: "{seriesId}__{YYYY-MM-DD}"
 */
export function occurrenceDocId(seriesId: string, date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${seriesId}__${y}-${m}-${d}`
}

/**
 * Generate a deterministic document ID for an after_completion occurrence
 * based on the completed predecessor task ID.
 * Format: "{seriesId}_after_{previousTaskId}"
 */
export function afterCompletionDocId(seriesId: string, previousTaskId: string): string {
  return `${seriesId}_after_${previousTaskId}`
}
