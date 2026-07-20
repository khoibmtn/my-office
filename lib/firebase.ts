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

  // 1. Check if already signed in (Firebase persists auth in IndexedDB)
  if (firebaseAuth.currentUser) {
    console.log('[Auth] Already signed in:', firebaseAuth.currentUser.isAnonymous ? 'anonymous' : 'Google')
    _saveTokens(firebaseAuth.currentUser)
    return firebaseAuth.currentUser
  }

  // 2. Try to process redirect result (if returning from Google sign-in)
  try {
    const redirectResult = await Promise.race([
      getRedirectResult(firebaseAuth),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ])
    if (redirectResult?.user) {
      console.log('[Auth] Signed in via redirect:', redirectResult.user.email)
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

  // 3. Wait briefly for Firebase to restore persisted auth from IndexedDB
  const restoredUser = await new Promise<User | null>((resolve) => {
    // onAuthStateChanged fires once with the persisted user (or null)
    const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
    // Timeout: don't wait forever
    setTimeout(() => resolve(null), 3000)
  })

  if (restoredUser) {
    console.log('[Auth] Restored persisted user:', restoredUser.isAnonymous ? 'anonymous' : restoredUser.email)
    _saveTokens(restoredUser)
    return restoredUser
  }

  // 4. No user at all → sign in anonymously
  try {
    console.log('[Auth] No user found, signing in anonymously...')
    const anonResult = await signInAnonymously(firebaseAuth)
    console.log('[Auth] Signed in anonymously')
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
 * Sign in with Google account (for Drive API access).
 * On localhost: popup. On production: redirect.
 */
export async function signInWithGoogle() {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'

  if (isLocalhost) {
    const result = await signInWithPopup(auth(), provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (credential?.accessToken) {
      localStorage.setItem('google_access_token', credential.accessToken)
    }
    return result
  }

  // Production: always use redirect (no popup issues)
  await signInWithRedirect(auth(), provider)
  return null
}

/**
 * Link Google account to current anonymous user (for Drive API).
 * Preserves the anonymous UID so Firestore data stays linked.
 */
export async function linkGoogleAccount(): Promise<User | null> {
  const firebaseAuth = auth()
  const currentUser = firebaseAuth.currentUser

  if (!currentUser) {
    // No current user, do a fresh Google sign-in
    return (await signInWithGoogle())?.user ?? null
  }

  if (!currentUser.isAnonymous) {
    // Already a Google user
    console.log('[Auth] Already signed in with Google')
    return currentUser
  }

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'

  try {
    if (isLocalhost) {
      const result = await linkWithPopup(currentUser, provider)
      const credential = GoogleAuthProvider.credentialFromResult(result)
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken)
      }
      _saveTokens(result.user)
      return result.user
    } else {
      await linkWithRedirect(currentUser, provider)
      return null // Will resolve after redirect
    }
  } catch (err: any) {
    // If linking fails (e.g., account already exists), fall back to regular sign-in
    if (err?.code === 'auth/credential-already-in-use' || err?.code === 'auth/email-already-in-use') {
      console.warn('[Auth] Google account already linked, signing in directly')
      return (await signInWithGoogle())?.user ?? null
    }
    throw err
  }
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
