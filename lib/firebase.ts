import { getApps, initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  linkWithPopup,
  linkWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

function getFirebaseApp() {
  if (typeof window === 'undefined') return null
  if (getApps().length > 0) return getApps()[0]

  // On production (non-localhost), use current domain as authDomain
  // so redirect auth stays on same domain (no third-party cookie issues)
  const isLocalhost = window.location.hostname === 'localhost'
  const authDomain = isLocalhost
    ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!
    : window.location.host

  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
}

export const ADMIN_EMAIL = 'khoibm.tn@gmail.com'

export function getGoogleAuthProvider(options?: {
  selectAccount?: boolean
  loginHint?: string
}) {
  const p = new GoogleAuthProvider()
  p.addScope('https://www.googleapis.com/auth/drive.file')

  const customParams: Record<string, string> = {}
  if (options?.selectAccount) {
    customParams.prompt = 'select_account'
  }
  if (options?.loginHint) {
    customParams.login_hint = options.loginHint
  } else if (!options?.selectAccount) {
    // Auto-select linked admin account to prevent user picking wrong account
    customParams.login_hint = ADMIN_EMAIL
  }

  p.setCustomParameters(customParams)
  return p
}

// Default provider instance
const provider = getGoogleAuthProvider()

export function getFirebaseAuth() {
  const app = getFirebaseApp()
  if (!app) throw new Error('Firebase not available server-side')
  return getAuth(app)
}

export function getFirebaseDb() {
  const app = getFirebaseApp()
  if (!app) throw new Error('Firebase not available server-side')
  return getFirestore(app)
}

let _auth: ReturnType<typeof getAuth> | null = null
let _db: ReturnType<typeof getFirestore> | null = null

export function auth() {
  if (!_auth) _auth = getFirebaseAuth()
  return _auth
}

export function db() {
  if (!_db) _db = getFirebaseDb()
  return _db
}

// === Auto-auth: ensure user is always authenticated ===
let _ensureAuthPromise: Promise<User | null> | null = null

/**
 * Save Google OAuth access token to localStorage and cookie (with timestamp).
 */
export function saveGoogleAccessToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('google_access_token', token)
  localStorage.setItem('google_access_token_saved_at', Date.now().toString())
  if (typeof document !== 'undefined') {
    document.cookie = `google_access_token=${token}; path=/; max-age=3600; SameSite=Lax`
  }
  window.dispatchEvent(new CustomEvent('google_token_updated', { detail: { token } }))
}

/**
 * Clear Google OAuth access token from localStorage and cookie.
 */
export function clearGoogleAccessToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('google_access_token')
  localStorage.removeItem('google_access_token_saved_at')
  if (typeof document !== 'undefined') {
    document.cookie = `google_access_token=; path=/; max-age=0; SameSite=Lax`
  }
  window.dispatchEvent(new Event('google_token_updated'))
}

export interface GoogleTokenExpiryInfo {
  hasToken: boolean
  isExpired: boolean
  savedAt: number | null
  minutesAgo: number | null
  expiresInMinutes: number
  remainingMs: number
  remainingFormatted: string
}

/**
 * Check Google OAuth access token status and expiration.
 * Google access tokens expire after 3600s (60 min).
 * We flag as expired after 55 min for proactive renewal.
 */
export function getGoogleTokenExpiryInfo(): GoogleTokenExpiryInfo {
  if (typeof window === 'undefined') {
    return {
      hasToken: false,
      isExpired: true,
      savedAt: null,
      minutesAgo: null,
      expiresInMinutes: 0,
      remainingMs: 0,
      remainingFormatted: 'Chưa có token',
    }
  }
  const token = localStorage.getItem('google_access_token')
  if (!token) {
    return {
      hasToken: false,
      isExpired: true,
      savedAt: null,
      minutesAgo: null,
      expiresInMinutes: 0,
      remainingMs: 0,
      remainingFormatted: 'Chưa có token',
    }
  }
  const rawSavedAt = localStorage.getItem('google_access_token_saved_at')
  if (!rawSavedAt) {
    return {
      hasToken: true,
      isExpired: false,
      savedAt: null,
      minutesAgo: 0,
      expiresInMinutes: 60,
      remainingMs: 3600000,
      remainingFormatted: 'Còn 60 phút',
    }
  }
  const savedAt = parseInt(rawSavedAt, 10)
  if (isNaN(savedAt)) {
    return {
      hasToken: true,
      isExpired: false,
      savedAt: null,
      minutesAgo: 0,
      expiresInMinutes: 60,
      remainingMs: 3600000,
      remainingFormatted: 'Còn 60 phút',
    }
  }
  const diffMs = Date.now() - savedAt
  const minutesAgo = Math.floor(diffMs / 60000)
  const isExpired = minutesAgo >= 55
  const remainingMs = Math.max(0, 3600000 - diffMs)
  const expiresInMinutes = Math.max(0, Math.floor(remainingMs / 60000))

  let remainingFormatted = ''
  if (isExpired || remainingMs <= 0) {
    remainingFormatted = 'Đã hết hạn'
  } else {
    const days = Math.floor(remainingMs / (24 * 3600000))
    const hours = Math.floor((remainingMs % (24 * 3600000)) / 3600000)
    const mins = Math.floor((remainingMs % 3600000) / 60000)

    if (days > 0) {
      remainingFormatted = hours > 0 ? `Còn ${days} ngày ${hours} giờ` : `Còn ${days} ngày`
    } else if (hours > 0) {
      remainingFormatted = mins > 0 ? `Còn ${hours} giờ ${mins} phút` : `Còn ${hours} giờ`
    } else {
      remainingFormatted = `Còn ${Math.max(1, mins)} phút`
    }
  }

  return {
    hasToken: true,
    isExpired,
    savedAt,
    minutesAgo,
    expiresInMinutes,
    remainingMs,
    remainingFormatted,
  }
}

export function hasGoogleToken(): boolean {
  const info = getGoogleTokenExpiryInfo()
  return info.hasToken && !info.isExpired
}

export function getGoogleAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('google_access_token')
}

/**
 * Ensure the user is authenticated (anonymous or Google).
 * - Checks getRedirectResult FIRST to intercept returning OAuth redirect credentials.
 * - If user is already signed in (Google or anonymous), returns immediately.
 * - Otherwise, signs in anonymously so Firestore rules pass.
 * 
 * This is fire-once and cached.
 */
export function ensureAuth(): Promise<User | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!_ensureAuthPromise) {
    _ensureAuthPromise = _doEnsureAuth()
  }
  return _ensureAuthPromise
}

async function _doEnsureAuth(): Promise<User | null> {
  const firebaseAuth = auth()

  // 1. Process redirect result FIRST before anything else!
  // When returning from signInWithRedirect, getRedirectResult() provides the Google credential
  // containing credential.accessToken for Google Drive. We must call this before checking currentUser.
  try {
    const redirectResult = await getRedirectResult(firebaseAuth)
    if (redirectResult?.user) {
      const credential = GoogleAuthProvider.credentialFromResult(redirectResult)
      if (credential?.accessToken) {
        saveGoogleAccessToken(credential.accessToken)
      }
      _saveTokens(redirectResult.user)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('firebase_redirect_in_progress')
      }
      return redirectResult.user
    }
  } catch (err: any) {
    console.warn('[Auth] Redirect result error (non-fatal):', err?.code || err)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('firebase_redirect_in_progress')
    }
  }

  await firebaseAuth.authStateReady()

  // 2. If already signed in with a Google account (non-anonymous), return it
  if (firebaseAuth.currentUser && !firebaseAuth.currentUser.isAnonymous) {
    _saveTokens(firebaseAuth.currentUser)
    return firebaseAuth.currentUser
  }

  // 3. If we already have a valid user (e.g. anonymous user for read rules), return it
  if (firebaseAuth.currentUser) {
    _saveTokens(firebaseAuth.currentUser)
    return firebaseAuth.currentUser
  }

  // 4. Anonymous sign-in fallback if still no user
  try {
    const anonResult = await signInAnonymously(firebaseAuth)
    return anonResult.user
  } catch (err) {
    console.error('[Auth] Anonymous sign-in failed:', err)
    return null
  }
}

async function _saveTokens(user: User) {
  try {
    const token = await user.getIdToken()
    localStorage.setItem('firebase_id_token', token)
    const refreshToken = (user as any).stsTokenManager?.refreshToken || user.refreshToken
    if (refreshToken) {
      localStorage.setItem('firebase_refresh_token', refreshToken)
    }
  } catch (err) {
    console.warn('[Auth] Failed to save tokens:', err)
  }
}

/**
 * Sign in with Google account (for Drive API access and Admin login).
 * Tries popup first; if blocked by browser, automatically falls back to redirect.
 * If useRedirect is true, directly uses redirect.
 */
export async function signInWithGoogle(
  useRedirect = false,
  options?: { selectAccount?: boolean; loginHint?: string }
) {
  const firebaseAuth = auth()
  const p = getGoogleAuthProvider(options)

  if (useRedirect) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('firebase_redirect_in_progress', 'true')
    }
    await signInWithRedirect(firebaseAuth, p)
    return null
  }

  try {
    const result = await signInWithPopup(firebaseAuth, p)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (credential?.accessToken) {
      saveGoogleAccessToken(credential.accessToken)
    }
    _saveTokens(result.user)
    return result
  } catch (popupErr: any) {
    // If popup was blocked by browser or cancelled by popup blocker
    if (
      popupErr?.code === 'auth/popup-blocked' ||
      popupErr?.code === 'auth/cancelled-popup-request'
    ) {
      console.warn('[Auth] Popup blocked, falling back to signInWithRedirect...')
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('firebase_redirect_in_progress', 'true')
      }
      await signInWithRedirect(firebaseAuth, p)
      return null
    }
    throw popupErr
  }
}

/**
 * Request or refresh Google Drive OAuth token without logging out.
 * 1. Attempts silent refresh via /api/drive/token first (fast, no user prompt, uses server refresh token).
 * 2. If silent refresh fails or options.skipSilent is true, triggers Google OAuth with auto-login_hint.
 */
export async function requestGoogleDriveToken(
  useRedirect = false,
  options?: {
    selectAccount?: boolean
    loginHint?: string
    skipSilent?: boolean
  }
): Promise<{ success: boolean; token?: string; error?: string; method?: 'silent' | 'popup' | 'redirect' }> {
  // 1. Silent refresh via server API if possible
  if (!useRedirect && !options?.selectAccount && !options?.skipSilent) {
    try {
      const res = await fetch('/api/drive/token')
      if (res.ok) {
        const data = await res.json()
        if (data?.success && data?.token) {
          saveGoogleAccessToken(data.token)
          return { success: true, token: data.token, method: 'silent' }
        }
      }
    } catch (silentErr) {
      console.warn('[Auth] Silent refresh /api/drive/token failed, continuing to OAuth:', silentErr)
    }
  }

  // 2. Google OAuth with login_hint
  const firebaseAuth = auth()
  const p = getGoogleAuthProvider(options)

  if (useRedirect) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('firebase_redirect_in_progress', 'true')
      sessionStorage.setItem('firebase_redirect_return_url', window.location.pathname)
    }
    await signInWithRedirect(firebaseAuth, p)
    return { success: true, method: 'redirect' }
  }

  try {
    const result = await signInWithPopup(firebaseAuth, p)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (credential?.accessToken) {
      saveGoogleAccessToken(credential.accessToken)
      _saveTokens(result.user)
      return { success: true, token: credential.accessToken, method: 'popup' }
    }
    return { success: false, error: 'Không nhận được access token từ Google' }
  } catch (popupErr: any) {
    if (
      popupErr?.code === 'auth/popup-blocked' ||
      popupErr?.code === 'auth/cancelled-popup-request'
    ) {
      console.warn('[Auth] Popup blocked during token request, falling back to redirect...')
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('firebase_redirect_in_progress', 'true')
        sessionStorage.setItem('firebase_redirect_return_url', window.location.pathname)
      }
      await signInWithRedirect(firebaseAuth, p)
      return { success: true, method: 'redirect' }
    }
    return { success: false, error: popupErr?.message || 'Lỗi kết nối Google' }
  }
}

/**
 * Link Google account to current user (for Drive API).
 */
export async function linkGoogleAccount(useRedirect = false): Promise<User | null> {
  const res = await requestGoogleDriveToken(useRedirect)
  if (res.success) {
    return auth().currentUser
  }
  return null
}

/**
 * Check if current user is signed in with Google (not anonymous).
 */
export function isGoogleUser(): boolean {
  const firebaseAuth = auth()
  const user = firebaseAuth.currentUser
  if (!user) return false
  return !user.isAnonymous
}

/**
 * Full reset: sign out, clear all tokens.
 * After reset, the next page load will auto-sign-in anonymously.
 */
export const resetSession = async () => {
  clearGoogleAccessToken()
  localStorage.removeItem('firebase_id_token')
  localStorage.removeItem('firebase_refresh_token')
  _ensureAuthPromise = null
  await signOut(auth())
}

// Keep backward compat
export const signOutUser = resetSession

// Legacy export - no longer needed, but keep for backward compat
export function waitForRedirectResult(): Promise<void> {
  return ensureAuth().then(() => {})
}
