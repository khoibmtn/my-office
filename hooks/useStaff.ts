'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import type { StaffMember } from '@/types'

export function useStaff(): {
  staff: StaffMember[]
  loading: boolean
  getStaffName: (staffId: string | undefined) => string
  getStaffById: (staffId: string | undefined) => StaffMember | undefined
} {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      const q = query(collection(db(), 'staff'), orderBy('shortName', 'asc'))
      unsub = onSnapshot(
        q,
        (snap) => {
          setStaff(snap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember)))
          setLoading(false)
        },
        (error) => {
          console.error('[useStaff] onSnapshot error:', error.code, error.message)
          setLoading(false)
        }
      )
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  // Build a lookup map for fast ID → name resolution
  const staffMap = useMemo(() => {
    const map = new Map<string, StaffMember>()
    staff.forEach(s => {
      map.set(s.id, s)
      // Also index by Firestore document ID (which may differ from s.id)
    })
    return map
  }, [staff])

  const getStaffName = useCallback((staffId: string | undefined): string => {
    if (!staffId) return ''
    const member = staffMap.get(staffId)
    return member?.shortName || staffId
  }, [staffMap])

  const getStaffById = useCallback((staffId: string | undefined): StaffMember | undefined => {
    if (!staffId) return undefined
    return staffMap.get(staffId)
  }, [staffMap])

  return { staff, loading, getStaffName, getStaffById }
}
