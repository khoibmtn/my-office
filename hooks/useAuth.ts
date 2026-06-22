'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, ensureGoogleToken } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), async (u) => {
      setUser(u)
      setLoading(false)

      // Auto-ensure Google access token exists for Drive uploads
      if (u) {
        // Small delay to not block rendering
        setTimeout(() => {
          ensureGoogleToken()
        }, 1000)
      }
    })
    return unsubscribe
  }, [])

  return { user, loading }
}
