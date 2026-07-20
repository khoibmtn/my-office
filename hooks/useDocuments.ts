'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, ensureAuth } from '../lib/firebase'
import type { Document } from '../types'

export function useDocuments(): { documents: Document[]; loading: boolean } {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // Wait for auth to be ready before subscribing to Firestore
    ensureAuth().then(() => {
      const q = query(collection(db(), 'documents'), orderBy('createdAt', 'desc'))
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Document)))
          setLoading(false)
        },
        (error) => {
          console.error('[useDocuments] Firestore onSnapshot error:', error.code, error.message)
          setLoading(false)
        }
      )
    }).catch((err) => {
      console.error('[useDocuments] ensureAuth failed:', err)
      setLoading(false)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return { documents, loading }
}
