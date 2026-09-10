/**
 * Pure recurrence occurrence generator.
 * ZERO dependencies — unit-testable, portable.
 *
 * Generates occurrence dates within a [windowStart, windowEnd] range
 * based on a RecurrenceRule.
 */

import type { RecurrenceRule } from './types'

const MAX_OCCURRENCES = 1000 // Safety cap

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
export function generateOccurrences(
  rule: RecurrenceRule,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  if (windowEnd < windowStart) return []

  const results: Date[] = []
  const anchor = new Date(rule.anchorDate)

  switch (rule.frequency) {
    case 'daily':
      return generateDaily(rule, anchor, windowStart, windowEnd)
    case 'weekly':
      return generateWeekly(rule, anchor, windowStart, windowEnd)
    case 'monthly':
      return generateMonthly(rule, anchor, windowStart, windowEnd)
    case 'yearly':
      return generateYearly(rule, anchor, windowStart, windowEnd)
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
    for (const day of monthDays) {
      const resolvedDay = day === -1
        ? resolveLastDay(year, month + 1) // month+1 because resolveLastDay expects 1-indexed
        : Math.min(day, resolveLastDay(year, month + 1))

      const date = new Date(year, month, resolvedDay)

      if (date > windowEnd) return results
      if (date >= windowStart && date >= anchor) {
        results.push(date)
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
      for (const d of days) {
        const resolvedDay = d === -1
          ? resolveLastDay(year, m)
          : Math.min(d, resolveLastDay(year, m))

        const date = new Date(year, m - 1, resolvedDay) // m is 1-indexed

        if (date > windowEnd) return results
        if (date >= windowStart && date >= anchor) {
          results.push(date)
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
