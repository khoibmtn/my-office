import 'server-only'
import { timingSafeEqual, createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'

export const COWORK_SCHEMA_VERSION = 'myoffice-cowork-1.0'

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** D-30: dedicated read-only token, valid ONLY on /api/cowork/v1/*. Missing env → 503 (fail closed). */
export function checkCoworkToken(req: Request): NextResponse | null {
  const tokens = [process.env.COWORK_API_TOKEN, process.env.COWORK_API_TOKEN_NEXT].filter(
    (t): t is string => !!t && t.length >= 32,
  )
  if (!tokens.length) return coworkError(503, 'NOT_CONFIGURED', 'API Cowork chưa được cấu hình')
  const header = req.headers.get('authorization') || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m || !tokens.some((t) => safeEqual(m[1].trim(), t))) return coworkError(401, 'UNAUTHORIZED', 'Token không hợp lệ')
  return null
}

const hits = new Map<string, number[]>()
function rateLimited(key: string): boolean {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter((t) => now - t < 60_000)
  arr.push(now)
  hits.set(key, arr)
  return arr.length > 30
}

export function coworkError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function coworkOk(data: unknown, warnings: unknown[] = []) {
  return NextResponse.json(
    { ok: true, schemaVersion: COWORK_SCHEMA_VERSION, generatedAt: new Date().toISOString(), warnings, data },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Wrap a Cowork route: auth + rate limit + access log (never logs the token). */
export async function runCowork(req: Request, handler: () => Promise<NextResponse>): Promise<NextResponse> {
  const denied = checkCoworkToken(req)
  const url = new URL(req.url)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  let res: NextResponse
  if (denied) res = denied
  else if (rateLimited(ipHash)) res = coworkError(429, 'RATE_LIMITED', 'Quá 30 yêu cầu/phút')
  else {
    try {
      res = await handler()
    } catch (e) {
      console.error('[cowork] handler error', e)
      res = coworkError(500, 'INTERNAL', 'Lỗi máy chủ')
    }
  }
  try {
    getAdminFirestore()
      .collection('coworkAccessLogs')
      .add({ at: new Date(), path: url.pathname, query: url.search.slice(0, 200), status: res.status, ipHash })
      .catch(() => {})
  } catch {
    // Logging must never break the response (e.g. admin SDK not configured → still return 503/401).
  }
  return res
}

export const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
