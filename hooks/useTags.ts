'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import type { Tag } from '@/types'

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      const col = collection(db(), 'tags')
      unsub = onSnapshot(
        col,
        (snap) => {
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag))
          const active = all.filter(t => !t.deletedAt)
          active.sort((a, b) => {
            const tA = (a.createdAt as any)?.seconds || 0
            const tB = (b.createdAt as any)?.seconds || 0
            return tB - tA
          })
          setTags(active)
          setLoading(false)
        },
        (err) => {
          console.error('[useTags] error:', err)
          setLoading(false)
        }
      )
    })

    return () => { if (unsub) unsub() }
  }, [])

  return { tags, loading }
}
