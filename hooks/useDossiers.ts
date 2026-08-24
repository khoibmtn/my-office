'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import { useRole } from './useRole'
import type { Dossier } from '@/types'

export function useDossiers() {
  const { role, staffId, isAdmin } = useRole()
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      if (role === 'guest') {
        setDossiers([])
        setLoading(false)
        return
      }

      const col = collection(db(), 'dossiers')
      unsub = onSnapshot(
        col,
        (snap) => {
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Dossier))
          // Client-side filter out soft-deleted items
          const active = all.filter(d => !d.deletedAt)
          // Filter by owner if not admin
          const userDossiers = isAdmin
            ? active
            : active.filter(d => !d.ownerId || d.ownerId === staffId || d.ownerId === 'admin' || d.ownerId === 'unknown')

          userDossiers.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
          setDossiers(userDossiers)
          setLoading(false)
        },
        (err) => {
          console.error('[useDossiers] error:', err)
          setLoading(false)
        }
      )
    })

    return () => { if (unsub) unsub() }
  }, [role, staffId, isAdmin])

  return { dossiers, loading }
}
