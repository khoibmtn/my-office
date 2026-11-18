import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { buildMonthInput, buildWeekInput } from '@/lib/weekly-report/server'
import { buildMonthDocx, buildWeekDocx, monthToMarkdown, weekToMarkdown } from '@/lib/weekly-report/export'

export const runtime = 'nodejs'

/** Admin download: ?month=YYYY-MM | ?week=YYYY-MM-DD, &format=md|docx (default md). */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, { adminOnly: true })
  if (!auth.ok) return auth.response
  const sp = new URL(request.url).searchParams
  const month = sp.get('month')
  const week = sp.get('week')
  const format = sp.get('format') === 'docx' ? 'docx' : 'md'
  try {
    if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      const input = await buildMonthInput(month, false)
      const [y, m] = month.split('-')
      const name = `${m}.${y}`
      return format === 'docx'
        ? file(await buildMonthDocx(input), `${name}.docx`)
        : file(Buffer.from(monthToMarkdown(input), 'utf8'), `${name}.md`)
    }
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
      const input = await buildWeekInput(week, true)
      return format === 'docx'
        ? file(await buildWeekDocx(input), `giao-ban-${week}.docx`)
        : file(Buffer.from(weekToMarkdown(input), 'utf8'), `giao-ban-${week}.md`)
    }
    return NextResponse.json({ error: 'Cần month=YYYY-MM hoặc week=YYYY-MM-DD' }, { status: 400 })
  } catch (e) {
    console.error('[weekly-reports/export]', e)
    return NextResponse.json({ error: 'Xuất file thất bại' }, { status: 500 })
  }
}

function file(buf: Buffer, name: string) {
  const type = name.endsWith('.docx')
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'text/markdown; charset=utf-8'
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}
