'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Document } from '../types'

export function useDocuments(): { documents: Document[]; loading: boolean } {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db(), 'documents'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Document)))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { documents, loading }
}
