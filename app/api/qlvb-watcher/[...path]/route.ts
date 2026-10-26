import { NextRequest, NextResponse } from 'next/server'
import { verifyIdTokenREST } from '@/lib/firebase-admin'

/**
 * Proxy tới API cấu hình của qlvb-watcher (Cloudflare Worker).
 * Chỉ admin (Google account ADMIN_EMAIL) được gọi; khoá quản trị Worker chỉ nằm ở server (Vercel env).
 *   QLVB_WATCHER_URL        = https://qlvb-watcher.khoibm.workers.dev
 *   QLVB_WATCHER_ADMIN_KEY  = ADMIN_KEY của Worker
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ADMIN_EMAIL = 'khoibm.tn@gmail.com'
const ALLOWED = new Set(['config', 'rules', 'action', 'schedule'])

async function proxy(req: NextRequest, path: string[]) {
  const base = process.env.QLVB_WATCHER_URL
  const key = process.env.QLVB_WATCHER_ADMIN_KEY
  if (!base || !key) {
    return NextResponse.json({ ok: false, message: 'Chưa cấu hình QLVB_WATCHER_URL / QLVB_WATCHER_ADMIN_KEY trên Vercel.' }, { status: 503 })
  }
  const target = path.join('/')
  if (path.length !== 1 || !ALLOWED.has(target)) {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 })
  }

  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!idToken) return NextResponse.json({ ok: false, message: 'Chưa đăng nhập.' }, { status: 401 })
  try {
    const user = await verifyIdTokenREST(idToken)
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ ok: false, message: 'Chỉ admin được cấu hình QLVB Watcher.' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ ok: false, message: 'Phiên đăng nhập hết hạn, tải lại trang.' }, { status: 401 })
  }

  const res = await fetch(`${base.replace(/\/+$/, '')}/api/${target}`, {
    method: req.method,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: req.method === 'GET' ? undefined : await req.text(),
    cache: 'no-store',
  })
  const text = await res.text()
  return new NextResponse(text, { status: res.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}
