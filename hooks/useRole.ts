'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import type { UserRole } from '@/types'

const ADMIN_EMAIL = 'khoibm.tn@gmail.com'

interface StaffSession {
  staffId: string
  staffDocId: string
  shortName: string
  fullName: string
}

interface RoleInfo {
  role: UserRole
  isAdmin: boolean
  isStaff: boolean
  isGuest: boolean
  staffId: string | null
  staffDocId: string | null
  staffName: string | null
  loading: boolean
  login: (session: StaffSession) => void
  logout: () => void
}

function getStoredSession(): StaffSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('staffSession')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function useRole(): RoleInfo {
  const { user, loading: authLoading } = useAuth()
  const [session, setSession] = useState<StaffSession | null>(getStoredSession)

  // Sync session from localStorage on mount
  useEffect(() => {
    const handleStorage = () => setSession(getStoredSession())
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const login = useCallback((s: StaffSession) => {
    localStorage.setItem('staffSession', JSON.stringify(s))
    setSession(s)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('staffSession')
    setSession(null)
  }, [])

  // Determine role
  let role: UserRole = 'guest'
  if (!authLoading && user) {
    if (!user.isAnonymous && user.email === ADMIN_EMAIL) {
      role = 'admin'
    } else if (session) {
      role = 'staff'
    }
  }

  return {
    role,
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
    isGuest: role === 'guest',
    staffId: session?.staffId || null,
    staffDocId: session?.staffDocId || null,
    staffName: session?.shortName || null,
    loading: authLoading,
    login,
    logout,
  }
}
