import { runCowork, coworkOk, coworkError, ISO_DATE } from '@/lib/cowork/auth'
import { listWeeksAdmin } from '@/lib/weekly-report/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return runCowork(req, async () => {
    const sp = new URL(req.url).searchParams
    const from = sp.get('from') || '0000-01-01'
    const to = sp.get('to') || '9999-12-31'
    if ((sp.get('from') && !ISO_DATE.test(from)) || (sp.get('to') && !ISO_DATE.test(to))) {
      return coworkError(400, 'BAD_PARAM', 'from/to phải dạng YYYY-MM-DD')
    }
    const weeks = (await listWeeksAdmin()).filter((w) => w.meetingDate >= from && w.meetingDate <= to)
    return coworkOk(
      weeks.map((w) => ({
        weekId: w.id, meetingDate: w.meetingDate, actualMeetingDate: w.actualMeetingDate ?? null,
        periodStart: w.periodStart, periodEnd: w.periodEnd, periodOverridden: !!w.periodOverridden,
        periodNote: w.periodNote ?? '', reportMonth: w.reportMonth, reportMonthOverridden: !!w.reportMonthOverridden,
        status: w.status,
      })),
    )
  })
}
