import { NextResponse } from 'next/server'
import { runCowork, coworkOk, coworkError, ISO_DATE } from '@/lib/cowork/auth'
import { buildWeekInput } from '@/lib/weekly-report/server'
import { toCoworkWeek, weekToMarkdown } from '@/lib/weekly-report/export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { weekId: string } }) {
  return runCowork(req, async () => {
    if (!ISO_DATE.test(params.weekId)) return coworkError(400, 'BAD_PARAM', 'weekId phải dạng YYYY-MM-DD')
    // Q4: Cowork only sees Mục 1 + advisory docs → never include rich sections.
    const input = await buildWeekInput(params.weekId, false)
    if (new URL(req.url).searchParams.get('format') === 'md') {
      return new NextResponse(weekToMarkdown(input), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' } })
    }
    const data = toCoworkWeek(input)
    return coworkOk(data, (data as { warnings?: unknown[] }).warnings ?? [])
  })
}
