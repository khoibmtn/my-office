'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, waitForRedirectResult } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // Wait for redirect result first, THEN listen to auth state
    waitForRedirectResult().finally(() => {
      unsubscribe = onAuthStateChanged(auth(), (u) => {
        setUser(u)
        setLoading(false)
      })
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return { user, loading }
}
