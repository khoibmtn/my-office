import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getWeekAdmin, listWeeksAdmin } from '@/lib/weekly-report/server'
import { resolvePeriod } from '@/lib/weekly-report/period'

export const runtime = 'nodejs'

/**
 * Proxy to bcsolieu `/api/cowork/v1/bao-cao-tuan` (server-to-server, token stays here).
 * Called ONLY when the admin presses "Lấy số liệu" or finalizes — never on page load (§15 Q5:
 * protect the Vercel free quota of both apps). The client stores the result as statsSnapshotJson.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, { adminOnly: true })
  if (!auth.ok) return auth.response
  const weekId = new URL(request.url).searchParams.get('weekId') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekId)) return NextResponse.json({ ok: false, message: 'weekId không hợp lệ' }, { status: 400 })

  const base = process.env.BCSOLIEU_BASE_URL
  const token = process.env.BCSOLIEU_API_TOKEN
  if (!base || !token) return NextResponse.json({ ok: false, message: 'Chưa cấu hình kết nối bcsolieu' }, { status: 503 })

  const stored = await getWeekAdmin(weekId)
  const period = stored
    ? { periodStart: stored.periodStart, periodEnd: stored.periodEnd }
    : resolvePeriod(weekId, await listWeeksAdmin())

  const url = new URL('/api/cowork/v1/bao-cao-tuan', base)
  url.searchParams.set('t2_tu', period.periodStart)
  url.searchParams.set('t2_den', period.periodEnd)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'my-office-weekly-report/1.0', Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      return NextResponse.json({ ok: false, message: json?.message || `bcsolieu trả lỗi ${res.status}` }, { status: 502 })
    }
    const d = json.data ?? json // bcsolieu returns fields at top level
    return NextResponse.json({
      ok: true,
      data: { rows: d.rows ?? [], groups: d.groups ?? [], prevRange: d.prevRange ?? null, currRange: d.currRange ?? null },
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'Không kết nối được bcsolieu (quá 20 giây)' }, { status: 504 })
  }
}
