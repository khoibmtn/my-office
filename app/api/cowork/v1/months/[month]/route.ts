import { NextResponse } from 'next/server'
import { runCowork, coworkOk, coworkError, YEAR_MONTH } from '@/lib/cowork/auth'
import { buildMonthInput } from '@/lib/weekly-report/server'
import { buildMonthDocx, monthToMarkdown, toCoworkMonth } from '@/lib/weekly-report/export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { month: string } }) {
  return runCowork(req, async () => {
    if (!YEAR_MONTH.test(params.month)) return coworkError(400, 'BAD_PARAM', 'month phải dạng YYYY-MM')
    const input = await buildMonthInput(params.month, false) // Q4: no rich sections
    const format = new URL(req.url).searchParams.get('format')
    const [y, m] = params.month.split('-')
    if (format === 'md') {
      return new NextResponse(monthToMarkdown(input), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' } })
    }
    if (format === 'docx') {
      return new NextResponse(new Uint8Array(await buildMonthDocx(input)), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${m}.${y}.docx"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    const data = toCoworkMonth(input)
    return coworkOk(data, data.warnings ?? [])
  })
}
