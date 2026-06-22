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
