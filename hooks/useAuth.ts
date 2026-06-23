'use client'

import { useEffect, useState } from 'react'
import { onIdTokenChanged, User } from 'firebase/auth'
import { auth, waitForRedirectResult } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // Wait for redirect result first, THEN listen to auth state
    waitForRedirectResult().finally(() => {
      unsubscribe = onIdTokenChanged(auth(), async (u) => {
        try {
          if (u) {
            const token = await u.getIdToken()
            localStorage.setItem('firebase_id_token', token)
          } else {
            localStorage.removeItem('firebase_id_token')
          }
        } catch (error) {
          console.error("Error getting ID token:", error)
          localStorage.removeItem('firebase_id_token')
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
