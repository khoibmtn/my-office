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

const provider = new GoogleAuthProvider()
provider.addScope('https://www.googleapis.com/auth/drive.file')

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
 * Ensure the user is authenticated (anonymous or Google).
 * - If user is already signed in (Google or anonymous), returns immediately.
 * - If returning from Google redirect, processes the redirect result.
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

  await firebaseAuth.authStateReady()

  // 1. Check if already signed in
  if (firebaseAuth.currentUser) {
    _saveTokens(firebaseAuth.currentUser)
    return firebaseAuth.currentUser
  }

  // 2. Process redirect result if available (e.g. from previous redirect attempt)
  try {
    const redirectResult = await getRedirectResult(firebaseAuth)
    if (redirectResult?.user) {
      const credential = GoogleAuthProvider.credentialFromResult(redirectResult)
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken)
      }
      _saveTokens(redirectResult.user)
      return redirectResult.user
    }
  } catch (err: any) {
    console.warn('[Auth] Redirect result error (non-fatal):', err?.code || err)
  }

  // 3. Anonymous sign-in fallback if still no user
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
 * Uses signInWithPopup directly to avoid cross-domain redirect issues on custom domains/Vercel.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth(), provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  if (credential?.accessToken) {
    localStorage.setItem('google_access_token', credential.accessToken)
  }
  _saveTokens(result.user)
  return result
}

/**
 * Link Google account to current user (for Drive API).
 * If anonymous or not signed in, signs in directly with Google popup.
 */
export async function linkGoogleAccount(): Promise<User | null> {
  const firebaseAuth = auth()
  const currentUser = firebaseAuth.currentUser

  if (!currentUser || currentUser.isAnonymous) {
    return (await signInWithGoogle())?.user ?? null
  }

  return currentUser
}

export function hasGoogleToken(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('google_access_token')
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
  localStorage.removeItem('google_access_token')
  localStorage.removeItem('firebase_id_token')
  localStorage.removeItem('firebase_refresh_token')
  // Reset cached promise so next ensureAuth() does fresh anonymous login
  _ensureAuthPromise = null
  await signOut(auth())
}

// Keep backward compat
export const signOutUser = resetSession

// Legacy export - no longer needed, but keep for backward compat
export function waitForRedirectResult(): Promise<void> {
  return ensureAuth().then(() => {})
}
