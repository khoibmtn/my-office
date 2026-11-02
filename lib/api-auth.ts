import 'server-only'
import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { initAdmin, getAdminFirestore, verifyIdTokenREST } from '@/lib/firebase-admin'
import { verifyStaffSession } from '@/lib/server/staff-session'
import { isValidIngestSecret } from '@/lib/ingest-auth'

export const ADMIN_EMAIL = 'khoibm.tn@gmail.com'

export type ApiCaller =
  | { kind: 'admin'; uid: string; email: string }
  | { kind: 'staff'; staffDocId: string; staffId: string }
  | { kind: 'ingest' }

export interface AuthOptions {
  /** Only the admin Google account is accepted */
  adminOnly?: boolean
  /** Accept `ingestSecret` (qlvb-watcher on Cloudflare) from the JSON/form body */
  allowIngest?: boolean
  /** Parsed request body, used to read firebaseIdToken / staffSessionToken / ingestSecret */
  body?: Record<string, unknown>
}

type AuthResult = { ok: true; caller: ApiCaller } | { ok: false; response: NextResponse }

/**
 * CORS: never `*`. Extension background/popup fetches are exempt from CORS thanks to
 * host_permissions, and qlvb-watcher calls server-to-server, so only chrome-extension
 * origins (optionally pinned by EXTENSION_ORIGIN) get reflected.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const pinned = process.env.EXTENSION_ORIGIN
  const allowed = pinned ? origin === pinned : origin.startsWith('chrome-extension://')
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Staff-Session',
    Vary: 'Origin',
  }
}

export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

async function verifyAdminIdToken(idToken: string): Promise<ApiCaller | null> {
  try {
    initAdmin()
    const decoded = await getAuth().verifyIdToken(idToken)
    if (decoded.firebase?.sign_in_provider === 'anonymous') return null
    const email = (decoded.email || '').toLowerCase()
    if (email !== ADMIN_EMAIL || decoded.email_verified === false) return null
    return { kind: 'admin', uid: decoded.uid, email }
  } catch (err: any) {
    // Expired/revoked → reject. Anything else (incl. an Admin SDK credential/project
    // mismatch, which also surfaces as auth/argument-error) → fall back to the
    // Identity Toolkit lookup used before; it validates the token on Google's side.
    const code = String(err?.code || '')
    if (code === 'auth/id-token-expired' || code === 'auth/id-token-revoked') return null
    try {
      const user = await verifyIdTokenREST(idToken)
      const email = String(user?.email || '').toLowerCase()
      if (email !== ADMIN_EMAIL || user?.emailVerified === false) return null
      return { kind: 'admin', uid: String(user.localId), email }
    } catch {
      return null
    }
  }
}

async function verifyStaff(token: string): Promise<ApiCaller | null> {
  const payload = verifyStaffSession(token)
  if (!payload) return null
  try {
    const snap = await getAdminFirestore().collection('staff').doc(payload.staffDocId).get()
    if (!snap.exists || snap.data()?.isActive !== true) return null
    return { kind: 'staff', staffDocId: payload.staffDocId, staffId: payload.staffId }
  } catch {
    return null
  }
}

/**
 * Authenticate an API request. Accepted credentials (first match wins):
 *  - `ingestSecret` in body (only when allowIngest)
 *  - Firebase ID token of the admin Google account (`Authorization: Bearer` or body.firebaseIdToken)
 *  - signed staff session (`X-Staff-Session` header or body.staffSessionToken) — not when adminOnly
 * Anonymous Firebase users and other Google accounts are rejected.
 */
export async function authenticateRequest(req: Request, opts: AuthOptions = {}): Promise<AuthResult> {
  const body = opts.body ?? {}
  const cors = corsHeaders(req)

  if (opts.allowIngest && isValidIngestSecret(body.ingestSecret)) {
    return { ok: true, caller: { kind: 'ingest' } }
  }

  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const idToken = bearer || (typeof body.firebaseIdToken === 'string' ? body.firebaseIdToken : '')
  if (idToken) {
    const admin = await verifyAdminIdToken(idToken)
    if (admin) return { ok: true, caller: admin }
  }

  if (!opts.adminOnly) {
    const staffToken =
      req.headers.get('x-staff-session') ||
      (typeof body.staffSessionToken === 'string' ? body.staffSessionToken : '')
    if (staffToken) {
      const staff = await verifyStaff(staffToken)
      if (staff) return { ok: true, caller: staff }
    }
  }

  const message = opts.adminOnly
    ? 'Chỉ tài khoản quản trị được dùng chức năng này.'
    : 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại My Office.'
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'UNAUTHORIZED', message },
      { status: idToken && opts.adminOnly ? 403 : 401, headers: cors }
    ),
  }
}
