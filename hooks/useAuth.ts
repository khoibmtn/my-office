'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, handleRedirectResult } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    async function init() {
      // First: handle redirect result (if coming back from Google)
      await handleRedirectResult()

      // Then: listen to auth state
      unsubscribe = onAuthStateChanged(auth(), (u) => {
        setUser(u)
        setLoading(false)
      })
    }

    init()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return { user, loading }
}
