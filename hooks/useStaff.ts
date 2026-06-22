'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useStaff(): string[] {
  const [staff, setStaff] = useState<string[]>([])

  useEffect(() => {
    const unsub = onSnapshot(doc(db(), 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const names = (data.staff || [])
          .map((s: { name: string }) => s.name)
          .filter(Boolean)
        setStaff(names)
      }
    })
    return unsub
  }, [])

  return staff
}
