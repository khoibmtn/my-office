import { describe, it, expect } from 'vitest'
import { generateOccurrences, resolveLastDay } from '@/lib/recurrence/generate'
import type { RecurrenceRule } from '@/lib/recurrence/types'

// Helper: local date (no timezone issues)
function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day, 0, 0, 0, 0)
}

describe('resolveLastDay', () => {
  it('returns 31 for January', () => expect(resolveLastDay(2026, 1)).toBe(31))
  it('returns 28 for Feb non-leap', () => expect(resolveLastDay(2025, 2)).toBe(28))
  it('returns 29 for Feb leap year', () => expect(resolveLastDay(2024, 2)).toBe(29))
  it('returns 30 for April', () => expect(resolveLastDay(2026, 4)).toBe(30))
  it('returns 31 for December', () => expect(resolveLastDay(2026, 12)).toBe(31))
})

describe('generateOccurrences — daily', () => {
  const baseRule: RecurrenceRule = {
    frequency: 'daily',
    interval: 1,
    anchorDate: d(2026, 9, 1),
    timezone: 'Asia/Ho_Chi_Minh',
  }

  it('generates daily occurrences within window', () => {
    const dates = generateOccurrences(baseRule, d(2026, 9, 1), d(2026, 9, 5))
    expect(dates).toHaveLength(5)
  })

  it('respects interval of 3 (every 3 days)', () => {
    const rule = { ...baseRule, interval: 3 }
    const dates = generateOccurrences(rule, d(2026, 9, 1), d(2026, 9, 10))
    expect(dates).toHaveLength(4)
  })

  it('returns empty for window before anchor', () => {
    expect(generateOccurrences(baseRule, d(2026, 8, 1), d(2026, 8, 15))).toEqual([])
  })
})

describe('generateOccurrences — weekly', () => {
  it('generates on specified weekdays', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      interval: 1,
      byWeekday: [1, 5], // Monday, Friday (ISO)
      anchorDate: d(2026, 9, 1),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2026, 9, 1), d(2026, 9, 14))
    // Check all are Mon or Fri (JS: 1=Mon, 5=Fri)
    const jsDays = dates.map(dt => dt.getDay())
    expect(jsDays.every(day => day === 1 || day === 5)).toBe(true)
    expect(dates.length).toBeGreaterThanOrEqual(3)
  })

  it('every 2 weeks on Wednesday', () => {
    // Sep 2, 2026 is a Wednesday
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      interval: 2,
      byWeekday: [3], // Wednesday
      anchorDate: d(2026, 9, 2),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2026, 9, 1), d(2026, 9, 30))
    expect(dates.length).toBeGreaterThanOrEqual(2)
    // First should be Sep 2 (Wed)
    expect(dates[0].getDate()).toBe(2)
    expect(dates[0].getDay()).toBe(3) // Wednesday
  })
})

describe('generateOccurrences — monthly', () => {
  it('generates on day 15 each month', () => {
    const rule: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byMonthDay: [15],
      anchorDate: d(2026, 1, 15),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2026, 1, 1), d(2026, 6, 30))
    expect(dates).toHaveLength(6)
    expect(dates.every(dt => dt.getDate() === 15)).toBe(true)
  })

  it('handles last day of month (-1)', () => {
    const rule: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byMonthDay: [-1],
      anchorDate: d(2026, 1, 31),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2026, 1, 1), d(2026, 4, 30))
    expect(dates).toHaveLength(4)
    expect(dates[0].getDate()).toBe(31) // Jan 31
    expect(dates[1].getDate()).toBe(28) // Feb 28
    expect(dates[2].getDate()).toBe(31) // Mar 31
    expect(dates[3].getDate()).toBe(30) // Apr 30
  })

  it('every 3 months', () => {
    const rule: RecurrenceRule = {
      frequency: 'monthly',
      interval: 3,
      byMonthDay: [1],
      anchorDate: d(2026, 1, 1),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2026, 1, 1), d(2026, 12, 31))
    expect(dates.map(dt => dt.getMonth() + 1)).toEqual([1, 4, 7, 10])
  })
})

describe('generateOccurrences — yearly', () => {
  it('generates on March 15 each year', () => {
    const rule: RecurrenceRule = {
      frequency: 'yearly',
      interval: 1,
      byMonth: [3],
      byMonthDay: [15],
      anchorDate: d(2025, 3, 15),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2025, 1, 1), d(2028, 12, 31))
    expect(dates).toHaveLength(4)
    expect(dates.every(dt => dt.getMonth() === 2 && dt.getDate() === 15)).toBe(true)
  })
})

describe('edge cases', () => {
  it('returns empty for end before start', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, anchorDate: d(2026, 1, 1), timezone: 'Asia/Ho_Chi_Minh' }
    expect(generateOccurrences(rule, d(2026, 2, 1), d(2026, 1, 1))).toEqual([])
  })

  it('caps at 1000 occurrences', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, anchorDate: d(2020, 1, 1), timezone: 'Asia/Ho_Chi_Minh' }
    const dates = generateOccurrences(rule, d(2020, 1, 1), d(2030, 1, 1))
    expect(dates.length).toBeLessThanOrEqual(1000)
  })
})

describe('generateOccurrences — bySetPos (first/last weekday of month)', () => {
  it('generates on first Monday of month (bySetPos: 1, byWeekday: [1])', () => {
    const rule: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byWeekday: [1], // Monday
      bySetPos: 1,    // First Monday
      anchorDate: d(2026, 9, 1),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2026, 9, 1), d(2026, 11, 30))
    expect(dates).toHaveLength(3)
    // Sep 2026: Sep 1 is Tue -> First Mon is Sep 7
    expect(dates[0].getDate()).toBe(7)
    expect(dates[0].getMonth() + 1).toBe(9)
    // Oct 2026: Oct 1 is Thu -> First Mon is Oct 5
    expect(dates[1].getDate()).toBe(5)
    expect(dates[1].getMonth() + 1).toBe(10)
    // Nov 2026: Nov 1 is Sun -> First Mon is Nov 2
    expect(dates[2].getDate()).toBe(2)
    expect(dates[2].getMonth() + 1).toBe(11)
  })

  it('generates on last Friday of month (bySetPos: -1, byWeekday: [5])', () => {
    const rule: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byWeekday: [5], // Friday
      bySetPos: -1,   // Last Friday
      anchorDate: d(2026, 9, 1),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(rule, d(2026, 9, 1), d(2026, 10, 31))
    expect(dates).toHaveLength(2)
    // Sep 2026: Last Friday is Sep 25
    expect(dates[0].getDate()).toBe(25)
    expect(dates[0].getMonth() + 1).toBe(9)
    // Oct 2026: Oct 31 is Sat -> Last Friday is Oct 30
    expect(dates[1].getDate()).toBe(30)
    expect(dates[1].getMonth() + 1).toBe(10)
  })
})

describe('generateOccurrences — weekendPolicy adjustment', () => {
  it('shifts Saturday and Sunday to Friday when weekendPolicy is shift_friday', () => {
    // Sep 5, 2026 is Saturday -> should shift to Friday Sep 4
    // Sep 6, 2026 is Sunday -> should shift to Friday Sep 4
    const ruleSat: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byMonthDay: [5], // Sep 5 is Sat
      weekendPolicy: 'shift_friday',
      anchorDate: d(2026, 9, 1),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const datesSat = generateOccurrences(ruleSat, d(2026, 9, 1), d(2026, 9, 30))
    expect(datesSat).toHaveLength(1)
    expect(datesSat[0].getDate()).toBe(4) // Friday Sep 4
    expect(datesSat[0].getDay()).toBe(5) // Friday

    const ruleSun: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byMonthDay: [6], // Sep 6 is Sun
      weekendPolicy: 'shift_friday',
      anchorDate: d(2026, 9, 1),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const datesSun = generateOccurrences(ruleSun, d(2026, 9, 1), d(2026, 9, 30))
    expect(datesSun).toHaveLength(1)
    expect(datesSun[0].getDate()).toBe(4) // Friday Sep 4
    expect(datesSun[0].getDay()).toBe(5) // Friday
  })

  it('shifts Saturday and Sunday to Monday when weekendPolicy is shift_monday', () => {
    // Sep 5, 2026 is Saturday -> should shift to Monday Sep 7
    const ruleSat: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byMonthDay: [5], // Sep 5 is Sat
      weekendPolicy: 'shift_monday',
      anchorDate: d(2026, 9, 1),
      timezone: 'Asia/Ho_Chi_Minh',
    }
    const dates = generateOccurrences(ruleSat, d(2026, 9, 1), d(2026, 9, 30))
    expect(dates).toHaveLength(1)
    expect(dates[0].getDate()).toBe(7) // Monday Sep 7
    expect(dates[0].getDay()).toBe(1) // Monday
  })
})
