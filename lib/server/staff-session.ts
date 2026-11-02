import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'crypto'

/**
 * Signed staff session token (HMAC-SHA256), issued by /api/auth/login.
 * Staff members sign in with nickname/password and are only *anonymous* Firebase users,
 * so API routes need this token to tell a logged-in staff member apart from any visitor.
 *
 * Format: v1.<base64url(json payload)>.<base64url(hmac)>
 */
export interface StaffSessionPayload {
  staffDocId: string
  staffId: string
  exp: number // unix seconds
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

function getSecret(): Buffer | null {
  const explicit = process.env.STAFF_SESSION_SECRET
  if (explicit) return createHash('sha256').update(`staff-session:${explicit}`).digest()
  // Fallback: derive from the Admin SDK private key so no new env var is strictly required
  const raw = process.env.FIREBASE_ADMIN_SDK_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    const key = JSON.parse(raw).private_key
    if (!key) return null
    return createHash('sha256').update(`staff-session:${key}`).digest()
  } catch {
    return null
  }
}

const b64url = (buf: Buffer) => buf.toString('base64url')

export function signStaffSession(staffDocId: string, staffId: string): string | null {
  const secret = getSecret()
  if (!secret) return null
  const payload: StaffSessionPayload = {
    staffDocId,
    staffId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const sig = b64url(createHmac('sha256', secret).update(`v1.${body}`).digest())
  return `v1.${body}.${sig}`
}

export function verifyStaffSession(token: unknown): StaffSessionPayload | null {
  if (typeof token !== 'string' || !token.startsWith('v1.')) return null
  const secret = getSecret()
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [, body, sig] = parts
  const expected = createHmac('sha256', secret).update(`v1.${body}`).digest()
  let given: Buffer
  try {
    given = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StaffSessionPayload
    if (!payload.staffDocId || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
