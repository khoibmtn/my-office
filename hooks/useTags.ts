'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import type { Tag } from '@/types'

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      const q = query(collection(db(), 'tags'), where('deletedAt', '==', null), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(
        q,
        (snap) => {
          setTags(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag)))
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
