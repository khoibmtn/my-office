import 'server-only'
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let adminApp: App | null = null

export function initAdmin(): App {
  if (adminApp) return adminApp
  if (getApps().length > 0) {
    adminApp = getApps()[0]
    return adminApp
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}')

  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })

  return adminApp
}

export function getAdminFirestore(): Firestore {
  initAdmin()
  return getFirestore()
}

export async function verifyIdTokenREST(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY');
  
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Invalid token');
  }
  
  if (!data.users || data.users.length === 0) {
    throw new Error('User not found');
  }
  
  return data.users[0];
}
