'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { onIdTokenChanged, User } from 'firebase/auth'
import { auth, ensureAuth } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // Safety timeout: if auth never resolves in 8s, force loading=false
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[AuthProvider] Auth not resolved after 8s, forcing loading=false')
          return false
        }
        return prev
      })
    }, 8000)

    ensureAuth()
      .then(() => {
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
            console.error('[AuthProvider] Error getting ID token:', error)
            localStorage.removeItem('firebase_id_token')
            localStorage.removeItem('firebase_refresh_token')
          } finally {
            setUser(u)
            setLoading(false)
            clearTimeout(safetyTimer)
          }
        })
      })
      .catch((err) => {
        console.error('[AuthProvider] ensureAuth failed:', err)
        setLoading(false)
        clearTimeout(safetyTimer)
      })

    return () => {
      clearTimeout(safetyTimer)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return React.createElement(AuthContext.Provider, { value: { user, loading } }, children)
}

export function useAuth() {
  return useContext(AuthContext)
}
