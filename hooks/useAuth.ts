'use client'

import { useEffect, useState } from 'react'
import { onIdTokenChanged, User, type Auth } from 'firebase/auth'
import { auth, waitForRedirectResult } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // Wait for redirect result first, THEN listen to auth state
    waitForRedirectResult().finally(() => {
      const firebaseAuth = auth()
      unsubscribe = onIdTokenChanged(firebaseAuth, async (u) => {
        try {
          if (u) {
            const token = await u.getIdToken()
            localStorage.setItem('firebase_id_token', token)
            // Also store refresh token for extension auto-refresh
            const refreshToken = (u as any).stsTokenManager?.refreshToken || u.refreshToken
            if (refreshToken) {
              localStorage.setItem('firebase_refresh_token', refreshToken)
            }
          } else {
            localStorage.removeItem('firebase_id_token')
            localStorage.removeItem('firebase_refresh_token')
          }
        } catch (error) {
          console.error("Error getting ID token:", error)
          localStorage.removeItem('firebase_id_token')
          localStorage.removeItem('firebase_refresh_token')
        } finally {
          setUser(u)
          setLoading(false)
        }
      })
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return { user, loading }
}
