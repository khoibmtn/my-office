'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'

export function useStaff(): string[] {
  const [staff, setStaff] = useState<string[]>([])

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      unsub = onSnapshot(
        doc(db(), 'settings', 'general'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            const names = (data.staff || [])
              .map((s: { name: string }) => s.name)
              .filter(Boolean)
            setStaff(names)
          }
        },
        (error) => {
          console.error('[useStaff] Firestore onSnapshot error:', error.code, error.message)
        }
      )
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  return staff
}
