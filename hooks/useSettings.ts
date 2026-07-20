'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'

export interface AppSettings {
  overdueColor: string           // days < 0
  expiredColor: string           // days = 0
  urgent1Color: string           // 1 <= days <= 3
  urgent2Color: string           // 4 <= days <= 7
  normalColor: string            // days > 7
  completedColor: string         // status = completed
}

const DEFAULT_SETTINGS: AppSettings = {
  overdueColor: '#ef4444',       // red-500
  expiredColor: '#f97316',       // orange-500
  urgent1Color: '#f59e0b',       // amber-500
  urgent2Color: '#eab308',       // yellow-500
  normalColor: '#22c55e',        // green-500
  completedColor: '#10b981',     // emerald-500
}

export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      const ref = doc(db(), 'settings', 'general')
      unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            setSettings({
              overdueColor: data.overdueColor ?? DEFAULT_SETTINGS.overdueColor,
              expiredColor: data.expiredColor ?? DEFAULT_SETTINGS.expiredColor,
              urgent1Color: data.urgent1Color ?? DEFAULT_SETTINGS.urgent1Color,
              urgent2Color: data.urgent2Color ?? DEFAULT_SETTINGS.urgent2Color,
              normalColor: data.normalColor ?? DEFAULT_SETTINGS.normalColor,
              completedColor: data.completedColor ?? DEFAULT_SETTINGS.completedColor,
            })
          }
        },
        (error) => {
          console.error('[useSettings] Firestore onSnapshot error:', error.code, error.message)
        }
      )
    }).catch((err) => {
      console.error('[useSettings] ensureAuth failed:', err)
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  return settings
}
