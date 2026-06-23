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

// === Redirect result (resolved once) ===
let _redirectPromise: Promise<void> | null = null

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
      .catch((err) => {
        console.log('Redirect result:', err?.code || err)
      })
  }
  return _redirectPromise
}

/**
 * Sign in: popup on localhost, redirect on production.
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

export function hasGoogleToken(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('google_access_token')
}

export const signOutUser = async () => {
  localStorage.removeItem('google_access_token')
  localStorage.removeItem('firebase_id_token')
  await signOut(auth())
}
