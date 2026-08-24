'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
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
      const q = isAdmin
        ? query(col, where('deletedAt', '==', null), orderBy('name', 'asc'))
        : query(col, where('ownerId', '==', staffId), where('deletedAt', '==', null), orderBy('name', 'asc'))

      unsub = onSnapshot(
        q,
        (snap) => {
          setDossiers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Dossier)))
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
