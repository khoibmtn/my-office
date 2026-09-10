/**
 * Recurrence rule types — pure, no framework dependencies.
 * Follows iCal RRULE concepts adapted for Vietnamese office context.
 */

export interface RecurrenceRule {
  /** Base frequency */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'

  /** Repeat every N periods (1 = every, 2 = every other, etc.) */
  interval: number

  /**
   * For weekly: which days of the week (ISO 8601: 1=Mon, 7=Sun)
   * E.g. [1, 5] = Monday and Friday
   */
  byWeekday?: number[]

  /**
   * For monthly: which day(s) of the month (1-31)
   * -1 = last day of month
   */
  byMonthDay?: number[]

  /**
   * For yearly: which month(s) (1-12)
   */
  byMonth?: number[]

  /**
   * For "first Monday of month" etc.
   * 1 = first, 2 = second, -1 = last
   */
  bySetPos?: number

  /** Start date of the series (anchor for interval calculation) */
  anchorDate: Date

  /** IANA timezone (e.g. "Asia/Ho_Chi_Minh") */
  timezone: string
}

export type MisfirePolicy = 'create_missed' | 'skip_missed'

export interface SeriesScheduleConfig {
  rule: RecurrenceRule
  rollingWindowDays: number
  leadDays: number
  dueTime?: string         // "17:00"
  dueOffsetMinutes?: number
  misfirePolicy: MisfirePolicy
  endDate?: Date | null
  maxOccurrences?: number | null
}
