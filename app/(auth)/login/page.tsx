'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Login page is no longer needed since we use auto-anonymous-auth.
 * Redirect to home immediately.
 */
export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return null
}
