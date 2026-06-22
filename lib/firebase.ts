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

/**
 * Sign in with Google.
 * Uses popup on localhost, redirect on production (to avoid popup blockers).
 */
export async function signInWithGoogle() {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'

  if (isLocalhost) {
    // Popup works fine on localhost
    const result = await signInWithPopup(auth(), provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (credential?.accessToken) {
      localStorage.setItem('google_access_token', credential.accessToken)
    }
    return result
  } else {
    // Use redirect on production to avoid popup blockers
    await signInWithRedirect(auth(), provider)
    return null // Page will redirect, won't reach here
  }
}

/**
 * Handle redirect result after Google sign-in redirect.
 * Call this on app load to process the redirect result.
 */
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth())
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result)
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken)
      }
      return result
    }
  } catch (err) {
    console.log('Redirect result check:', err)
  }
  return null
}

/**
 * Ensure google_access_token is in localStorage.
 * Does NOT auto-popup — only checks if token exists.
 */
export function hasGoogleToken(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('google_access_token')
}

export const signOutUser = async () => {
  localStorage.removeItem('google_access_token')
  await signOut(auth())
}
