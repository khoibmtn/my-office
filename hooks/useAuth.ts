'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, handleRedirectResult } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle redirect result (from signInWithRedirect on production)
    handleRedirectResult().then(() => {
      // Auth state listener
      const unsubscribe = onAuthStateChanged(auth(), (u) => {
        setUser(u)
        setLoading(false)
      })
      return unsubscribe
    })

    // Also listen immediately in case redirect check takes time
    const unsubscribe = onAuthStateChanged(auth(), (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { user, loading }
}
