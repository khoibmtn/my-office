import { runCowork, coworkOk } from '@/lib/cowork/auth'
import { getConfigAdmin, listWeeksAdmin } from '@/lib/weekly-report/server'
import { PERIOD_RULES_TEXT } from '@/types/weekly-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return runCowork(req, async () => {
    const [config, weeks] = await Promise.all([getConfigAdmin(), listWeeksAdmin()])
    return coworkOk({
      docTypes: config.docTypes,
      monthRule: config.monthRule,
      periodRules: PERIOD_RULES_TEXT,
      dataScope: 'Chỉ Mục 1 (việc đã làm) và văn bản đã tham mưu. Không có Ý kiến / Tuần tới / Đề xuất lịch / Ý kiến PGĐ.',
      firstWeekId: weeks[0]?.id ?? null,
      lastWeekId: weeks[weeks.length - 1]?.id ?? null,
      specialWeeks: weeks
        .filter((w) => w.periodOverridden || w.actualMeetingDate)
        .map((w) => ({ weekId: w.id, periodStart: w.periodStart, periodEnd: w.periodEnd, actualMeetingDate: w.actualMeetingDate ?? null, periodNote: w.periodNote ?? '' })),
      endpoints: ['/catalog', '/weeks?from&to', '/weeks/{weekId}?format=json|md', '/months/{YYYY-MM}?format=json|md|docx', '/advisory-docs?from&to&type'],
    })
  })
}
