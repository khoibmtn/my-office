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
          // IMPORTANT: Keep the custom `id` field from the staff document data,
          // NOT the Firestore auto-generated document ID.
          // Documents reference staff via the custom `id` (e.g., "39tcwz8g"),
          // not the Firestore doc ID.
          setStaff(snap.docs.map(d => {
            const data = d.data() as StaffMember
            return { ...data, _docId: d.id } as StaffMember & { _docId: string }
          }))
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
      // Index by custom staff ID (primary key used in assigneeId)
      if (s.id) map.set(s.id, s)
      // Also index by shortName for backward compatibility with old name-based assignments
      if (s.shortName) map.set(s.shortName, s)
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

