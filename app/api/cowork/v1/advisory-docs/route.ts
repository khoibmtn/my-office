import { runCowork, coworkOk, coworkError, ISO_DATE } from '@/lib/cowork/auth'
import { getConfigAdmin, listAdvisoryByDateRangeAdmin } from '@/lib/weekly-report/server'
import { countByType, sortAdvisory } from '@/lib/weekly-report/advisory-format'
import { DOC_TYPE_PREFIX } from '@/types/weekly-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Advisory docs over any date range (quarter, half-year, year) + counts by type and by month. */
export async function GET(req: Request) {
  return runCowork(req, async () => {
    const sp = new URL(req.url).searchParams
    const from = sp.get('from') || ''
    const to = sp.get('to') || ''
    const type = sp.get('type')
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) return coworkError(400, 'BAD_PARAM', 'Cần from<=to dạng YYYY-MM-DD')
    const [config, all] = await Promise.all([getConfigAdmin(), listAdvisoryByDateRangeAdmin(from, to)])
    const docs = sortAdvisory(type ? all.filter((d) => d.type === type) : all)
    const label = new Map(config.docTypes.map((t) => [t.code, t.label]))
    const byMonth: Record<string, number> = {}
    docs.forEach((d) => { const k = d.advisedDate.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + 1 })
    return coworkOk({
      from, to, total: docs.length,
      countsByType: countByType(docs, config.docTypes),
      countsByMonth: byMonth,
      docs: docs.map((d) => ({
        type: d.type, typeLabel: label.get(d.type) ?? d.type, prefix: DOC_TYPE_PREFIX[d.type] ?? d.type,
        title: d.title, docNumber: d.docNumber ?? null, advisedDate: d.advisedDate, weekId: d.weekId,
        highlight: !!d.highlight,
        sources: (d.sourceSnapshot ?? []).map((s) => ({ docNumber: s.docNumber, title: s.title, sender: s.sender, issueDate: s.issueDate ?? null })),
      })),
    })
  })
}
