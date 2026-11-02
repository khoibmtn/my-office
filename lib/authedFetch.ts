'use client'

import { auth } from './firebase'

/**
 * Credentials for internal API routes (see lib/api-auth.ts):
 *  - admin: Firebase ID token of the Google account (Authorization: Bearer)
 *  - staff: signed session token from /api/auth/login (X-Staff-Session)
 */
export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  try {
    const user = auth().currentUser
    if (user && !user.isAnonymous) {
      headers.Authorization = `Bearer ${await user.getIdToken()}`
    }
  } catch {
    // Firebase not ready — fall through to staff session
  }
  try {
    const raw = localStorage.getItem('staffSession')
    const token = raw ? JSON.parse(raw)?.sessionToken : null
    if (token) headers['X-Staff-Session'] = token
  } catch {
    // ignore malformed session
  }
  return headers
}

let redirecting = false

/**
 * Staff without a valid signed session (logged in before the session token existed, token
 * expired, account deactivated): clear the local session and send them to /login once.
 */
function handleStaffSessionExpired() {
  if (redirecting || typeof window === 'undefined') return
  if (!localStorage.getItem('staffSession')) return
  redirecting = true
  localStorage.removeItem('staffSession')
  alert('Phiên đăng nhập đã hết hạn hoặc cần cập nhật. Vui lòng đăng nhập lại.')
  window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`
}

export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getApiAuthHeaders()
  const headers = new Headers(init.headers)
  Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v))
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401 && !authHeaders.Authorization) {
    handleStaffSessionExpired()
  }
  return res
}
