'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, Timestamp, where, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Document } from '../types'

export function useDeadlineDocuments(): { documents: Document[]; loading: boolean } {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const q = query(
      collection(db(), 'documents'),
      where('deadline', '>=', Timestamp.now()),
      where('deadline', '<=', Timestamp.fromDate(sevenDaysFromNow)),
      orderBy('deadline', 'asc'),
      limit(10)
    )
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Document)))
        setLoading(false)
      },
      (error) => {
        console.error('[useDeadlineDocuments] Firestore onSnapshot error:', error.code, error.message)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  return { documents, loading }
}
