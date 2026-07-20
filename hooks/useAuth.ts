'use client'

import { useEffect, useState } from 'react'
import { onIdTokenChanged, User } from 'firebase/auth'
import { auth, ensureAuth } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // Safety timeout: if auth never resolves in 10s, force loading=false
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[useAuth] Auth not resolved after 10s, forcing loading=false')
          return false
        }
        return prev
      })
    }, 10000)

    // ensureAuth() handles everything: restore persisted user, redirect result, or anonymous sign-in
    ensureAuth().then(() => {
      const firebaseAuth = auth()
      unsubscribe = onIdTokenChanged(firebaseAuth, async (u) => {
        try {
          if (u) {
            const token = await u.getIdToken()
            localStorage.setItem('firebase_id_token', token)
            const refreshToken = (u as any).stsTokenManager?.refreshToken || u.refreshToken
            if (refreshToken) {
              localStorage.setItem('firebase_refresh_token', refreshToken)
            }
          } else {
            localStorage.removeItem('firebase_id_token')
            localStorage.removeItem('firebase_refresh_token')
          }
        } catch (error) {
          console.error('[useAuth] Error getting ID token:', error)
          localStorage.removeItem('firebase_id_token')
          localStorage.removeItem('firebase_refresh_token')
        } finally {
          setUser(u)
          setLoading(false)
          clearTimeout(safetyTimer)
        }
      })
    })

    return () => {
      clearTimeout(safetyTimer)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return { user, loading }
}
