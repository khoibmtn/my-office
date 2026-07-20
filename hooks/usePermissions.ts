'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import { useRole } from './useRole'
import type { RolePermissions } from '@/types'

const ADMIN_PERMISSIONS: RolePermissions = {
  canViewAll: true,
  canAddDocument: true,
  canEditDocument: true,
  canDeleteDocument: true,
  canAssignStaff: true,
  canSetDeadline: true,
  canSetCompletedDate: true,
  canEditNotes: true,
  canToggleComplete: true,
  canCompleteAssigned: true,
  canCopyTaskString: true,
  canAccessSettings: true,
}

const DEFAULT_STAFF: RolePermissions = {
  canViewAll: true,
  canAddDocument: false,
  canEditDocument: false,
  canDeleteDocument: false,
  canAssignStaff: false,
  canSetDeadline: false,
  canSetCompletedDate: false,
  canEditNotes: false,
  canToggleComplete: false,
  canCompleteAssigned: true,
  canCopyTaskString: true,
  canAccessSettings: false,
}

const DEFAULT_GUEST: RolePermissions = {
  canViewAll: true,
  canAddDocument: false,
  canEditDocument: false,
  canDeleteDocument: false,
  canAssignStaff: false,
  canSetDeadline: false,
  canSetCompletedDate: false,
  canEditNotes: false,
  canToggleComplete: false,
  canCompleteAssigned: false,
  canCopyTaskString: true,
  canAccessSettings: false,
}

export function usePermissions(): RolePermissions & { loading: boolean } {
  const { role, isAdmin, staffId } = useRole()
  const [perms, setPerms] = useState<{ staff: RolePermissions; guest: RolePermissions }>({
    staff: DEFAULT_STAFF,
    guest: DEFAULT_GUEST,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      unsub = onSnapshot(
        doc(db(), 'settings', 'permissions'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            setPerms({
              staff: { ...DEFAULT_STAFF, ...data.staff },
              guest: { ...DEFAULT_GUEST, ...data.guest },
            })
          }
          setLoading(false)
        },
        () => setLoading(false)
      )
    })

    return () => { if (unsub) unsub() }
  }, [])

  if (isAdmin) {
    return { ...ADMIN_PERMISSIONS, loading: false }
  }

  const rolePerms = role === 'staff' ? perms.staff : perms.guest

  return { ...rolePerms, loading, staffId } as RolePermissions & { loading: boolean; staffId?: string | null }
}
