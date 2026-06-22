import { getApps, initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

function getFirebaseApp() {
  if (typeof window === 'undefined') return null
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
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

// Lazy singletons for client use
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

// === Auth redirect result promise (resolved once on app load) ===
let _redirectPromise: Promise<void> | null = null

/**
 * Process redirect result. Safe to call multiple times — only runs once.
 */
export function waitForRedirectResult(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!_redirectPromise) {
    _redirectPromise = getRedirectResult(auth())
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result)
          if (credential?.accessToken) {
            localStorage.setItem('google_access_token', credential.accessToken)
          }
        }
      })
      .catch(() => {
        // Ignore — no redirect result
      })
  }
  return _redirectPromise
}

/**
 * Sign in with Google.
 * Tries popup first. If blocked, falls back to redirect.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth(), provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (credential?.accessToken) {
      localStorage.setItem('google_access_token', credential.accessToken)
    }
    return result
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
      // Fallback to redirect
      await signInWithRedirect(auth(), provider)
      return null
    }
    throw err
  }
}

export function hasGoogleToken(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('google_access_token')
}

export const signOutUser = async () => {
  localStorage.removeItem('google_access_token')
  await signOut(auth())
}
