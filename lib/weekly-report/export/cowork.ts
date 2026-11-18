import {
  DEFAULT_WEEKLY_REPORT_CONFIG,
  DOC_TYPE_PREFIX,
  type AdvisoryDoc,
  type AdvisorySourceSnapshot,
  type ISODate,
  type WeekPeriod,
  type WeeklyReport,
  type WeeklyReportConfig,
  type WeeklyReportStatus,
  type YearMonth,
} from '@/types/weekly-report'
import { countByType, sortAdvisoryForReport } from '../advisory-format'
import { diffDays, formatDMY, isBoundaryWeek, reportMonthFor, todayVN } from '../period'

export type CoworkWarningCode =
  | 'WEEK_NOT_FINALIZED'
  | 'WEEK_MISSING'
  | 'MONTH_INCOMPLETE'
  | 'BOUNDARY_WEEK'
  | 'MONTH_OVERRIDDEN'
  | 'PERIOD_OVERRIDDEN'

export interface CoworkWarning {
  code: CoworkWarningCode
  weekId?: string
  month?: YearMonth
  message: string
}

export interface CoworkWorkItemChild {
  id: string
  text: string
  highlight: boolean
  order: number
}

export interface CoworkWorkItem {
  id: string
  text: string
  highlight: boolean
  pinned: boolean
  order: number
  children: CoworkWorkItemChild[]
}

export interface CoworkAdvisoryDoc {
  id: string
  type: string
  typeLabel: string
  prefix: string
  title: string
  docNumber: string | null
  advisedDate: ISODate
  weekId: string
  sourceSnapshot: AdvisorySourceSnapshot[]
  highlight: boolean
}

export interface CoworkTypeCount {
  code: string
  label: string
  prefix: string
  count: number
}

export interface CoworkWeek {
  weekId: string
  meetingDate: ISODate
  actualMeetingDate: ISODate | null
  periodStart: ISODate
  periodEnd: ISODate
  dayCount: number
  periodOverridden: boolean
  periodNote: string
  reportMonth: YearMonth
  reportMonthOverridden: boolean
  isBoundaryWeek: boolean
  status: WeeklyReportStatus | 'missing'
  unitHeading: string
  workItems: CoworkWorkItem[]
  advisoryDocs: CoworkAdvisoryDoc[]
  countsByType: CoworkTypeCount[]
  total: number
  warnings: CoworkWarning[]
}

export interface CoworkMonth {
  month: YearMonth
  weeks: CoworkWeek[]
  advisoryDocs: CoworkAdvisoryDoc[]
  countsByType: CoworkTypeCount[]
  total: number
  warnings: CoworkWarning[]
}

export interface ToCoworkWeekInput {
  week: WeeklyReport | (WeekPeriod & Partial<WeeklyReport>)
  advisory: AdvisoryDoc[]
  config: WeeklyReportConfig
  today?: ISODate
}

export interface ToCoworkMonthInput {
  month: YearMonth
  weeks: Array<{ period: WeekPeriod; report: WeeklyReport | null; advisory: AdvisoryDoc[] }>
  config: WeeklyReportConfig
  today?: ISODate
}

function mapAdvisoryDocs(
  docs: AdvisoryDoc[],
  config: WeeklyReportConfig,
): CoworkAdvisoryDoc[] {
  const typeLabelMap = new Map(config.docTypes.map((t) => [t.code, t.label]))
  return sortAdvisoryForReport(docs, config.docTypes).map((doc) => ({
    id: doc.id,
    type: doc.type,
    typeLabel: typeLabelMap.get(doc.type) ?? doc.type,
    prefix: DOC_TYPE_PREFIX[doc.type] ?? doc.type,
    title: doc.title,
    docNumber: doc.docNumber ?? null,
    advisedDate: doc.advisedDate,
    weekId: doc.weekId,
    sourceSnapshot: (doc.sourceSnapshot ?? []).map((s) => ({
      id: s.id,
      docNumber: s.docNumber,
      title: s.title,
      sender: s.sender,
      issueDate: s.issueDate ?? null,
    })),
    highlight: Boolean(doc.highlight),
  }))
}

export function toCoworkWeek(input: ToCoworkWeekInput): CoworkWeek {
  const { week, advisory, config } = input
  const weekId = 'weekId' in week && week.weekId ? week.weekId : week.id ?? week.meetingDate
  const status: WeeklyReportStatus | 'missing' = week.status ?? 'missing'
  const dayCount =
    'dayCount' in week && typeof week.dayCount === 'number'
      ? week.dayCount
      : diffDays(week.periodStart, week.periodEnd) + 1

  const periodObj: WeekPeriod = {
    weekId,
    meetingDate: week.meetingDate,
    periodStart: week.periodStart,
    periodEnd: week.periodEnd,
    dayCount,
  }

  const periodOverridden = Boolean(week.periodOverridden)
  const reportMonthOverridden = Boolean(week.reportMonthOverridden)
  const reportMonth = week.reportMonth ?? reportMonthFor(week.periodStart, week.periodEnd)
  const boundary = isBoundaryWeek(periodObj)

  const warnings: CoworkWarning[] = []
  if (status === 'missing') {
    warnings.push({
      code: 'WEEK_MISSING',
      weekId,
      message: `Tuần ${formatDMY(week.meetingDate)} chưa có dữ liệu báo cáo`,
    })
  } else if (status === 'draft') {
    warnings.push({
      code: 'WEEK_NOT_FINALIZED',
      weekId,
      message: `Tuần ${formatDMY(week.meetingDate)} chưa chốt`,
    })
  }
  if (boundary) {
    warnings.push({
      code: 'BOUNDARY_WEEK',
      weekId,
      message: `Tuần ${formatDMY(week.meetingDate)} là tuần giáp ranh hai tháng (${formatDMY(week.periodStart)} – ${formatDMY(week.periodEnd)})`,
    })
  }
  if (reportMonthOverridden) {
    warnings.push({
      code: 'MONTH_OVERRIDDEN',
      weekId,
      message: `Tuần ${formatDMY(week.meetingDate)} được gán tháng báo cáo thủ công (${reportMonth})`,
    })
  }
  if (periodOverridden) {
    warnings.push({
      code: 'PERIOD_OVERRIDDEN',
      weekId,
      message: `Tuần ${formatDMY(week.meetingDate)} có kỳ đặc biệt được chỉnh thủ công`,
    })
  }

  const workItems: CoworkWorkItem[] = [...(week.workItems ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      id: item.id,
      text: item.text,
      highlight: Boolean(item.highlight),
      pinned: Boolean(item.pinned),
      order: item.order,
      children: [...(item.children ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          id: c.id,
          text: c.text,
          highlight: Boolean(c.highlight),
          order: c.order,
        })),
    }))

  const sortedRawAdv = sortAdvisoryForReport(advisory, config.docTypes)
  const advisoryDocs = mapAdvisoryDocs(sortedRawAdv, config)
  const countsByType = countByType(sortedRawAdv, config.docTypes)

  return {
    weekId,
    meetingDate: week.meetingDate,
    actualMeetingDate: week.actualMeetingDate ?? null,
    periodStart: week.periodStart,
    periodEnd: week.periodEnd,
    dayCount,
    periodOverridden,
    periodNote: week.periodNote ?? '',
    reportMonth,
    reportMonthOverridden,
    isBoundaryWeek: boundary,
    status,
    unitHeading:
      week.unitHeading || config.unitHeading || DEFAULT_WEEKLY_REPORT_CONFIG.unitHeading,
    workItems,
    advisoryDocs,
    countsByType,
    total: advisoryDocs.length,
    warnings,
  }
}

export function toCoworkMonth(input: ToCoworkMonthInput): CoworkMonth {
  const today = input.today ?? todayVN()
  const weeks = input.weeks.map((entry) =>
    toCoworkWeek({
      week: entry.report ? { ...entry.period, ...entry.report } : entry.period,
      advisory: entry.advisory,
      config: input.config,
      today,
    }),
  )

  const seenIds = new Set<string>()
  const uniqueRawAdv: AdvisoryDoc[] = []
  for (const entry of input.weeks) {
    for (const doc of entry.advisory) {
      if (doc.id && seenIds.has(doc.id)) continue
      if (doc.id) seenIds.add(doc.id)
      uniqueRawAdv.push(doc)
    }
  }

  const sortedAllAdv = sortAdvisoryForReport(uniqueRawAdv, input.config.docTypes)
  const advisoryDocs = mapAdvisoryDocs(sortedAllAdv, input.config)
  const countsByType = countByType(sortedAllAdv, input.config.docTypes)

  const warnings: CoworkWarning[] = []
  if (input.weeks.length > 0) {
    const lastPeriodEnd = input.weeks.reduce(
      (max, w) => (w.period.periodEnd > max ? w.period.periodEnd : max),
      input.weeks[0].period.periodEnd,
    )
    if (today <= lastPeriodEnd) {
      warnings.push({
        code: 'MONTH_INCOMPLETE',
        month: input.month,
        message: `Tháng ${input.month} chưa đủ dữ liệu (kỳ cuối kết thúc ngày ${formatDMY(lastPeriodEnd)})`,
      })
    }
  }

  for (const w of weeks) {
    warnings.push(...w.warnings)
  }

  return {
    month: input.month,
    weeks,
    advisoryDocs,
    countsByType,
    total: advisoryDocs.length,
    warnings,
  }
}
