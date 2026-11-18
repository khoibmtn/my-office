import {
  DEFAULT_WEEKLY_REPORT_CONFIG,
  RICH_SECTION_LABELS,
  type AdvisoryDoc,
  type RichSectionKey,
  type WeekPeriod,
  type WeeklyReport,
  type WeeklyReportConfig,
  type YearMonth,
} from '@/types/weekly-report'
import { formatAdvisoryLine, formatAdvisorySummary, sortAdvisoryForReport } from '../advisory-format'
import { formatDMY } from '../period'
import { tiptapToMarkdown } from './tiptap-markdown'

export interface WeekExportInput {
  week: WeeklyReport | (WeekPeriod & Partial<WeeklyReport>)
  advisory: AdvisoryDoc[]
  config: WeeklyReportConfig
  includeRichSections: boolean
}

export interface MonthExportInput {
  month: YearMonth
  weeks: Array<{ period: WeekPeriod; report: WeeklyReport | null; advisory: AdvisoryDoc[] }>
  config: WeeklyReportConfig
  includeRichSections: boolean
}

const RICH_SECTION_ORDER: RichSectionKey[] = [
  'opinions',
  'nextWeek',
  'proposedSchedule',
  'deputyOpinions',
]

function formatBulletText(text: string, highlight: boolean): string {
  const trimmed = text.trim()
  return highlight ? `**${trimmed}**` : trimmed
}

export function weekToMarkdown(input: WeekExportInput): string {
  const { week, advisory, config, includeRichSections } = input
  const displayDate = week.actualMeetingDate || week.meetingDate
  const title = config.reportTitle || DEFAULT_WEEKLY_REPORT_CONFIG.reportTitle
  const unitHeading =
    week.unitHeading || config.unitHeading || DEFAULT_WEEKLY_REPORT_CONFIG.unitHeading

  const lines: string[] = [
    formatDMY(displayDate),
    title,
    unitHeading,
    'Tình hình thực hiện nhiệm vụ tuần qua:',
  ]

  const workItems = [...(week.workItems ?? [])].sort((a, b) => a.order - b.order)
  for (const item of workItems) {
    const parentText = item.text.trim()
    const children = [...(item.children ?? [])]
      .sort((a, b) => a.order - b.order)
      .filter((c) => c.text.trim() !== '')

    if (!parentText && children.length === 0) continue
    if (parentText) {
      lines.push(`- ${formatBulletText(parentText, item.highlight)}`)
    }
    for (const child of children) {
      lines.push(`  - ${formatBulletText(child.text, child.highlight)}`)
    }
  }

  const sortedAdv = sortAdvisoryForReport(advisory, config.docTypes)
  lines.push(`- ${formatAdvisorySummary(sortedAdv, config.docTypes)}`)
  for (const doc of sortedAdv) {
    const advLine = formatAdvisoryLine(doc)
    if (!advLine) continue
    lines.push(`  - ${formatBulletText(advLine, doc.highlight)}`)
  }

  if (includeRichSections && week.sections) {
    for (const key of RICH_SECTION_ORDER) {
      const sec = week.sections[key]
      if (!sec) continue
      const body = tiptapToMarkdown(sec.docJson) || (sec.plainText?.trim() ?? '')
      if (!body) continue
      const label =
        key === 'deputyOpinions'
          ? config.deputySectionLabel || RICH_SECTION_LABELS.deputyOpinions
          : RICH_SECTION_LABELS[key]
      lines.push('', label, body)
    }
  }

  return lines.join('\n')
}

export function monthToMarkdown(input: MonthExportInput): string {
  return input.weeks
    .map(({ period, report, advisory }) =>
      weekToMarkdown({
        week: report ? { ...period, ...report } : period,
        advisory,
        config: input.config,
        includeRichSections: input.includeRichSections,
      }),
    )
    .filter((block) => block !== '')
    .join('\n\n')
}
