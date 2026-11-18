import { describe, it, expect } from 'vitest'
import {
  todayVN, addDays, diffDays, dayOfWeek, formatDMY, formatDM, defaultMeetingDateFor, defaultPeriod,
  resolvePeriod, weekIdForDate, currentWeekId, reportMonthFor, weeksOfMonth, isBoundaryWeek,
} from '@/lib/weekly-report/period'
import type { WeekPeriodInfo } from '@/types/weekly-report'

const saved = (o: Partial<WeekPeriodInfo> & { id: string }): WeekPeriodInfo => ({
  meetingDate: o.id, periodStart: '', periodEnd: '', periodOverridden: false, reportMonth: '', reportMonthOverridden: false, ...o,
})

const tet: WeekPeriodInfo = saved({
  id: '2027-02-05', periodStart: '2027-01-29', periodEnd: '2027-02-03', periodOverridden: true, reportMonth: '2027-01',
})

describe('date helpers', () => {
  it('todayVN uses UTC+7', () => {
    expect(todayVN(new Date('2026-11-18T18:00:00Z'))).toBe('2026-11-19')
    expect(todayVN(new Date('2026-11-18T16:59:00Z'))).toBe('2026-11-18')
  })
  it('basic arithmetic and formatting', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(diffDays('2026-11-06', '2026-11-12')).toBe(6)
    expect(dayOfWeek('2026-11-13')).toBe(5)
    expect(formatDMY('2026-11-06')).toBe('06/11/2026')
    expect(formatDM('2026-11-06')).toBe('06/11')
  })
})

describe('week id and period (AC-K1, K2)', () => {
  it('weekIdForDate', () => {
    expect(weekIdForDate('2026-11-12')).toBe('2026-11-13')
    expect(weekIdForDate('2026-11-13')).toBe('2026-11-20')
    expect(weekIdForDate('2026-11-18')).toBe('2026-11-20')
    expect(defaultMeetingDateFor('2026-11-14')).toBe('2026-11-20')
  })
  it('defaultPeriod', () => {
    const p = defaultPeriod('2026-11-13')
    expect([p.periodStart, p.periodEnd, p.dayCount]).toEqual(['2026-11-06', '2026-11-12', 7])
  })
  it('currentWeekId: Friday is its own week', () => {
    expect(currentWeekId('2026-11-13')).toBe('2026-11-13')
    expect(currentWeekId('2026-11-18')).toBe('2026-11-20')
  })
})

describe('reportMonthFor (table 4.2)', () => {
  const cases: Array<[string, string]> = [
    ['2026-01-02', '2025-12'], ['2026-04-03', '2026-03'], ['2026-05-01', '2026-04'], ['2026-06-05', '2026-06'],
    ['2026-07-03', '2026-06'], ['2026-08-07', '2026-08'], ['2026-09-04', '2026-08'], ['2026-10-02', '2026-09'],
    ['2026-11-06', '2026-11'], ['2026-12-04', '2026-11'], ['2027-01-01', '2026-12'],
  ]
  it.each(cases)('meeting %s -> %s', (meeting, month) => {
    const p = defaultPeriod(meeting)
    expect(reportMonthFor(p.periodStart, p.periodEnd)).toBe(month)
  })
  it('tie goes to periodEnd month', () => {
    expect(reportMonthFor('2026-01-30', '2026-02-02')).toBe('2026-02')
  })
  it('isBoundaryWeek', () => {
    expect(isBoundaryWeek(defaultPeriod('2026-11-06'))).toBe(true)
    expect(isBoundaryWeek(defaultPeriod('2026-11-13'))).toBe(false)
  })
})

describe('weeksOfMonth (AC-K4, K5)', () => {
  it('October and November 2026', () => {
    expect(weeksOfMonth('2026-10', []).map((w) => w.weekId)).toEqual(['2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'])
    expect(weeksOfMonth('2026-11', []).map((w) => w.weekId)).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27', '2026-12-04'])
  })
  it('the 12 months of 2026 partition the Fridays with no overlap or gap', () => {
    const all: string[] = []
    for (let m = 1; m <= 12; m++) all.push(...weeksOfMonth(`2026-${String(m).padStart(2, '0')}`, []).map((w) => w.weekId))
    expect(new Set(all).size).toBe(all.length)
    // every Friday from 2026-01-09 through 2026-12-04 appears exactly once
    for (let f = '2026-01-09'; f <= '2026-12-04'; f = addDays(f, 7)) expect(all).toContain(f)
  })
  it('reportMonth override moves the week out of one month and into another', () => {
    const w = saved({
      id: '2026-11-06', periodStart: '2026-10-30', periodEnd: '2026-11-05', reportMonth: '2026-10', reportMonthOverridden: true,
    })
    expect(weeksOfMonth('2026-11', [w]).map((x) => x.weekId)).not.toContain('2026-11-06')
    expect(weeksOfMonth('2026-10', [w]).map((x) => x.weekId)).toContain('2026-11-06')
  })
})

describe('Tet case (early meeting)', () => {
  const weeks = [tet]
  it('weekIdForDate picks the next week for days after the overridden period', () => {
    expect(weekIdForDate('2027-02-04', weeks)).toBe('2027-02-12')
    expect(weekIdForDate('2027-02-02', weeks)).toBe('2027-02-05')
  })
  it('resolvePeriod stitches the next week to the end of the previous one', () => {
    const p = resolvePeriod('2027-02-12', weeks)
    expect([p.periodStart, p.periodEnd, p.dayCount]).toEqual(['2027-02-04', '2027-02-11', 8])
    expect(resolvePeriod('2027-02-05', weeks).periodEnd).toBe('2027-02-03')
  })
  it('does not change a normal later week', () => {
    expect(resolvePeriod('2027-02-19', weeks).periodStart).toBe('2027-02-12')
  })
})
